import type { ChatResponseLength } from "@shared/types/settings.types";

export interface ChatPreset {
	id: string;
	label: string;
	description: string;
	instruction: string;
	responseLength: ChatResponseLength;
}

export const CHAT_PRESETS: ChatPreset[] = [
	{
		id: "default",
		label: "Default",
		description: "General-purpose assistant for your knowledge base",
		instruction: "",
		responseLength: "medium",
	},
	{
		id: "tutor",
		label: "Tutor",
		description:
			"Best for educational content, helping you grasp new concepts and skills efficiently",
		instruction:
			"You are a patient tutor. Explain concepts step by step, use analogies, ask guiding questions to check understanding. Connect new concepts to what the user already knows from their notes.",
		responseLength: "detailed",
	},
	{
		id: "summarizer",
		label: "Summarizer",
		description: "Condense notes into key takeaways",
		instruction:
			"Focus on extracting and presenting the most important points. Use bullet points and highlight key terms. Omit details unless asked.",
		responseLength: "short",
	},
	{
		id: "quiz",
		label: "Quiz Me",
		description: "Test your knowledge with questions from your notes",
		instruction:
			"Generate questions based on the user's notes and flashcards to test their understanding. Start with a question, wait for the answer, then provide feedback. Vary question types: recall, application, comparison.",
		responseLength: "medium",
	},
];
