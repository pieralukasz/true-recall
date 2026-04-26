import { z } from "zod";
export declare const FlashcardItemSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    cardType: z.ZodLiteral<"basic">;
    question: z.ZodString;
    answer: z.ZodString;
    id: z.ZodString;
    alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    cardType: z.ZodLiteral<"cloze">;
    clozeTemplate: z.ZodString;
    clozeIndex: z.ZodNumber;
    question: z.ZodString;
    answer: z.ZodString;
    id: z.ZodString;
    alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    cardType: z.ZodLiteral<"reversed">;
    reverseOfBatchId: z.ZodOptional<z.ZodString>;
    question: z.ZodString;
    answer: z.ZodString;
    id: z.ZodString;
    alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    cardType: z.ZodLiteral<"image-occlusion">;
    question: z.ZodString;
    answer: z.ZodString;
    id: z.ZodString;
    alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    question: z.ZodString;
    answer: z.ZodString;
    cardType: z.ZodLiteral<"note-review">;
    alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>], "cardType">;
export declare const FlashcardInfoSchema: z.ZodObject<{
    exists: z.ZodBoolean;
    filePath: z.ZodString;
    cardCount: z.ZodNumber;
    questions: z.ZodArray<z.ZodString>;
    flashcards: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        cardType: z.ZodLiteral<"basic">;
        question: z.ZodString;
        answer: z.ZodString;
        id: z.ZodString;
        alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        cardType: z.ZodLiteral<"cloze">;
        clozeTemplate: z.ZodString;
        clozeIndex: z.ZodNumber;
        question: z.ZodString;
        answer: z.ZodString;
        id: z.ZodString;
        alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        cardType: z.ZodLiteral<"reversed">;
        reverseOfBatchId: z.ZodOptional<z.ZodString>;
        question: z.ZodString;
        answer: z.ZodString;
        id: z.ZodString;
        alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        cardType: z.ZodLiteral<"image-occlusion">;
        question: z.ZodString;
        answer: z.ZodString;
        id: z.ZodString;
        alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        question: z.ZodString;
        answer: z.ZodString;
        cardType: z.ZodLiteral<"note-review">;
        alwaysTypeIn: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>], "cardType">>;
    lastModified: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export type FlashcardInfoPayload = z.infer<typeof FlashcardInfoSchema>;
