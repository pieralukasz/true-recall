import type { ApkgData, ConvertedCard } from "@true-recall/core/types";
export declare class AnkiConverterService {
    convert(data: ApkgData): ConvertedCard[];
    private convertCard;
    private convertBasicCard;
    private convertClozeCard;
    private convertReversedCard;
    private renderAnkiTemplate;
    private findClozeFieldName;
    /**
     * After all cards are converted, link each reversed card (ord=1) back to
     * the basic card (ord=0) from the same note via reverseOfAnkiCardId.
     */
    private linkReversedCards;
    private htmlToMarkdown;
    private stripTags;
    private extractMediaFiles;
}
