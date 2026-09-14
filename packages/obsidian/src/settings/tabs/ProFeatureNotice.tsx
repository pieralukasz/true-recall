import { TRUERECALL_PRO_GUIDE_URL } from "@true-recall/core/constants";
import { withPluginUtm } from "@true-recall/core/utils";

interface ProFeatureNoticeProps {
	message: string;
}

/** Description shown under a disabled Pro-only control, with a link to the
 * docs page that lists what Pro unlocks. */
export function ProFeatureNotice({ message }: ProFeatureNoticeProps) {
	return (
		<span>
			{message}{" "}
			<a
				href={withPluginUtm(TRUERECALL_PRO_GUIDE_URL, "pro-notice")}
				class="ep:text-obs-accent"
				target="_blank"
				rel="noreferrer"
			>
				Learn what Pro includes
			</a>
		</span>
	);
}
