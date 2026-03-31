import { z } from "zod";
export declare const FlashcardItemSchema: z.ZodObject<{
    question: z.ZodString;
    answer: z.ZodString;
    id: z.ZodString;
    cardType: z.ZodOptional<z.ZodEnum<{
        basic: "basic";
        cloze: "cloze";
        reversed: "reversed";
        "image-occlusion": "image-occlusion";
    }>>;
    clozeTemplate: z.ZodOptional<z.ZodString>;
    clozeIndex: z.ZodOptional<z.ZodNumber>;
    reverseOfBatchId: z.ZodOptional<z.ZodString>;
    alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const FlashcardInfoSchema: z.ZodObject<{
    exists: z.ZodBoolean;
    filePath: z.ZodString;
    cardCount: z.ZodNumber;
    questions: z.ZodArray<z.ZodString>;
    flashcards: z.ZodArray<z.ZodObject<{
        question: z.ZodString;
        answer: z.ZodString;
        id: z.ZodString;
        cardType: z.ZodOptional<z.ZodEnum<{
            basic: "basic";
            cloze: "cloze";
            reversed: "reversed";
            "image-occlusion": "image-occlusion";
        }>>;
        clozeTemplate: z.ZodOptional<z.ZodString>;
        clozeIndex: z.ZodOptional<z.ZodNumber>;
        reverseOfBatchId: z.ZodOptional<z.ZodString>;
        alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    lastModified: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export type { FlashcardItem } from "../../types/flashcard.types";
export type FlashcardInfoPayload = z.infer<typeof FlashcardInfoSchema>;
