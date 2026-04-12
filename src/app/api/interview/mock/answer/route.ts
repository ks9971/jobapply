import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = rateLimit(`interview-mock-answer:${session.user.id}`, 30, 60000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { sessionId, questionIndex, answer } = body;

  if (!sessionId || questionIndex === undefined || questionIndex === null || !answer?.trim()) {
    return NextResponse.json(
      { error: "sessionId, questionIndex, and answer are required" },
      { status: 400 }
    );
  }

  // Fetch the mock session and verify ownership
  const mockSession = await db.mockSession.findUnique({
    where: { id: sessionId },
  });

  if (!mockSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (mockSession.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (mockSession.status === "completed") {
    return NextResponse.json(
      { error: "This mock session is already completed" },
      { status: 400 }
    );
  }

  // Parse questions and existing answers
  let questions: string[];
  let userAnswers: Array<{
    questionIndex: number;
    answer: string;
    score: number;
    feedback: string;
  }>;

  try {
    questions = JSON.parse(mockSession.questions);
  } catch {
    return NextResponse.json(
      { error: "Invalid session data" },
      { status: 500 }
    );
  }

  try {
    userAnswers = JSON.parse(mockSession.userAnswers);
  } catch {
    userAnswers = [];
  }

  const qIndex = Number(questionIndex);
  if (qIndex < 0 || qIndex >= questions.length) {
    return NextResponse.json(
      { error: `Invalid questionIndex. Must be 0-${questions.length - 1}` },
      { status: 400 }
    );
  }

  // Check if this question was already answered
  if (userAnswers.some((a) => a.questionIndex === qIndex)) {
    return NextResponse.json(
      { error: "This question has already been answered" },
      { status: 400 }
    );
  }

  const currentQuestion = questions[qIndex];

  try {
    const openai = getOpenAI();

    // Evaluate the answer
    const evalResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert interview evaluator for the Indian job market. Evaluate the candidate's answer to the interview question.

Score from 1 to 10:
- 1-3: Poor — missing key points, irrelevant, or too vague
- 4-5: Below average — partially addresses the question but lacks depth
- 6-7: Good — covers main points with reasonable detail
- 8-9: Excellent — comprehensive, well-structured, with specific examples
- 10: Outstanding — perfect answer with unique insights

For HR questions (CTC, notice period), evaluate if the candidate handles the negotiation tactfully.
For technical questions, evaluate correctness, depth, and clarity.
For behavioral questions, check if they use the STAR method effectively.

Return valid JSON:
{
  "score": <number 1-10>,
  "feedback": "2-4 sentences of specific, actionable feedback. Mention what was good and what could be improved."
}`,
        },
        {
          role: "user",
          content: `Interview Question: ${currentQuestion}\n\nCandidate's Answer: ${answer}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const evalContent = evalResponse.choices[0].message.content;
    if (!evalContent) {
      return NextResponse.json(
        { error: "No evaluation from AI" },
        { status: 500 }
      );
    }

    let evaluation;
    try {
      evaluation = JSON.parse(evalContent);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse evaluation" },
        { status: 500 }
      );
    }

    const score = Math.min(10, Math.max(1, Number(evaluation.score) || 5));
    const feedback = evaluation.feedback || "No feedback available.";

    // Add this answer to the list
    userAnswers.push({
      questionIndex: qIndex,
      answer: answer.trim(),
      score,
      feedback,
    });

    const isLastQuestion = userAnswers.length >= questions.length;
    const nextQuestionIndex = qIndex + 1;
    const hasNextQuestion = nextQuestionIndex < questions.length;

    let totalScore: number | null = null;
    let overallFeedback: string | null = null;

    if (isLastQuestion) {
      // Calculate total score as average percentage
      const avgScore =
        userAnswers.reduce((sum, a) => sum + a.score, 0) / userAnswers.length;
      totalScore = Math.round(avgScore * 10); // Convert to 0-100 scale

      // Generate overall feedback
      const overallResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an interview coach. Based on the candidate's performance across all questions in a mock interview, provide a concise overall assessment.

Return valid JSON:
{
  "feedback": "3-5 sentences covering: overall impression, strongest areas, areas for improvement, and one specific tip for their next real interview. Keep it encouraging but honest. Include India-specific advice if relevant (e.g., CTC negotiation tips, how to handle notice period questions)."
}`,
          },
          {
            role: "user",
            content: `Mock Interview Results:\n${userAnswers
              .map(
                (a) =>
                  `Q: ${questions[a.questionIndex]}\nA: ${a.answer}\nScore: ${a.score}/10\nFeedback: ${a.feedback}`
              )
              .join("\n\n")}\n\nAverage Score: ${avgScore.toFixed(1)}/10`,
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
        response_format: { type: "json_object" },
      });

      const overallContent = overallResponse.choices[0].message.content;
      if (overallContent) {
        try {
          const overallParsed = JSON.parse(overallContent);
          overallFeedback = overallParsed.feedback || null;
        } catch {
          overallFeedback = "Mock interview completed. Review your individual question scores for detailed feedback.";
        }
      }
    }

    // Update the session in DB
    await db.mockSession.update({
      where: { id: sessionId },
      data: {
        userAnswers: JSON.stringify(userAnswers),
        ...(isLastQuestion
          ? {
              status: "completed",
              totalScore,
              feedback: overallFeedback,
              completedAt: new Date(),
            }
          : {}),
      },
    });

    // Build response
    const responseData: Record<string, unknown> = {
      questionIndex: qIndex,
      score,
      feedback,
    };

    if (isLastQuestion) {
      responseData.completed = true;
      responseData.totalScore = totalScore;
      responseData.overallFeedback = overallFeedback;
      responseData.nextQuestion = null;
    } else if (hasNextQuestion) {
      responseData.completed = false;
      responseData.nextQuestion = {
        index: nextQuestionIndex,
        question: questions[nextQuestionIndex],
      };
    } else {
      responseData.completed = false;
      responseData.nextQuestion = null;
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Mock answer evaluation error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate answer" },
      { status: 500 }
    );
  }
}
