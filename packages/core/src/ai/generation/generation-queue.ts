interface QueuedGenerationJob {
	run: () => Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (reason: unknown) => void;
}

const generationQueue: QueuedGenerationJob[] = [];
let isConsumingGenerationQueue = false;

export function enqueueGeneration<T>(run: () => Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		generationQueue.push({
			run,
			resolve: (value) => resolve(value as T),
			reject,
		});
		void consumeGenerationQueue();
	});
}

async function consumeGenerationQueue(): Promise<void> {
	if (isConsumingGenerationQueue) return;
	isConsumingGenerationQueue = true;

	try {
		while (generationQueue.length > 0) {
			const job = generationQueue.shift();
			if (!job) continue;

			try {
				job.resolve(await job.run());
			} catch (error) {
				job.reject(error);
			}
		}
	} finally {
		isConsumingGenerationQueue = false;
	}
}
