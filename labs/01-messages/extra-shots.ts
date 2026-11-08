import { client, MODEL } from "../client";

type Label = "idea" | "todo" | "question";
type Note = { text: string; label: Label };

const notes: Note[] = [
  {
    text: "What if the coach quizzed me on my weakest domain every morning?",
    label: "idea",
  },
  { text: "Rotate my API key in the Console", label: "todo" },
  {
    text: "Why does stream() not need await but finalMessage() does?",
    label: "question",
  },
  {
    text: "The Inspector could show stop_reason in red when it's max_tokens",
    label: "idea",
  },
  { text: "Commit the labs before the end of the day", label: "todo" },
  {
    text: "I wonder whether prompt caching works together with streaming",
    label: "question",
  }, // tricky: no "?"
  {
    text: "Flashcards could be generated from my own LEARNING.md rules",
    label: "idea",
  },
  { text: "Paste the 1d break results into LEARNING.md", label: "todo" },
  { text: "Does the API merge two user turns in a row?", label: "question" },
  { text: "Check whether the SDK retries a 529", label: "todo" }, // tricky: sounds like a question
];

const examples: Note[] = [
  { text: "A dark mode for the Coach page", label: "idea" },
  { text: "Read the Streaming Responses lesson tomorrow", label: "todo" },
  { text: "How many tokens does one PDF page cost?", label: "question" },
];

const buildPrompt = (noteText: string, shots: number): string => {
  let prompt =
    "Classify the note as idea, todo or question. Answer with one word.\n\n";
  examples.slice(0, shots).forEach((example) => {
    prompt += `Note: ${example.text}\nLabel: ${example.label}\n\n`;
  });
  prompt += `Note: ${noteText}\nLabel:`;
  return prompt;
};

const classify = async (noteText: string, shots: number) => {
  const prompt = buildPrompt(noteText, shots);
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 10,
    messages: [{ role: "user", content: prompt }],
    // thinking: { type: "disabled" },
  });
  const answer = res.content
    .find((block) => block.type === "text")
    ?.text.trim();

  console.log({ answer });

  if (!answer) {
    console.log({ stop_reason: res.stop_reason });
    throw new Error("No answer returned from the model");
  }

  return {
    answer,
    inputTokens: res.usage.input_tokens,
  };
};

for (const shots of [0, 1, 3]) {
  let correct = 0;
  let tokens = 0;
  for (const note of notes) {
    const { answer, inputTokens } = await classify(note.text, shots);
    const ok = answer.trim().toLowerCase() === note.label;
    if (ok) {
      correct++;
    }
    tokens += inputTokens;
    console.log(
      `Note: "${note.text}" | Expected: ${note.label} | Got: ${answer} | Correct: ${ok}`,
    );
  }
  console.log(
    `Shots: ${shots} | Correct: ${correct}/${notes.length} | Tokens: ${tokens}`,
  );
}

// Predict before you run:
// 1. Which setup gets the most correct, and does zero-shot keep to one word?
// - keeps one word, but occasionally capitalizes the first letter.

// 2. One-shot shows only the "idea" example. Will that push answers toward "idea"?
// - Yes, it will likely bias the model towards classifying notes as "idea" since it has seen that example. but it may still correctly classify notes that are clearly "todo" or "question" based on their content.

// 3. Roughly how many more input tokens per call does few-shot cost than zero-shot?
// - around 700 tokens more for 10 questions. zero took around 500, few took around 1200.

// 4. Which of the two tricky notes gets misclassified?
// - it mostly errors question "Check whether the SDK retries a 529" as "question", but its 'todo'. And almost always at zero-shot.
