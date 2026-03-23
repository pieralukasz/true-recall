import type { AuthState } from "@features/integration/services/sync/auth.service";
import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	TextInput,
} from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useEffect, useState } from "preact/hooks";

export function AccountSection() {
	const plugin = usePlugin();
	const authService = plugin.authService;

	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [magicLinkSent, setMagicLinkSent] = useState(false);
	const [authState, setAuthState] = useState<AuthState | null>(null);
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		if (!authService) {
			setChecking(false);
			return;
		}
		authService.getAuthState().then((state) => {
			setAuthState(state);
			setChecking(false);
		});

		const { unsubscribe } = authService.onAuthStateChange((_event, session) => {
			setAuthState({
				user: session?.user ?? null,
				session,
				isAuthenticated: session !== null,
			});
		});
		return unsubscribe;
	}, [authService]);

	const handleMagicLink = useCallback(async () => {
		if (!authService || !email) return;
		setLoading(true);
		setError("");
		const result = await authService.signInWithMagicLink(email);
		if (!result.success) {
			setError(result.error ?? "Failed to send magic link");
		} else {
			setMagicLinkSent(true);
		}
		setLoading(false);
	}, [authService, email]);

	const handleGoogle = useCallback(async () => {
		if (!authService) return;
		setLoading(true);
		setError("");
		const result = await authService.signInWithGoogle();
		if ("url" in result) {
			window.open(result.url);
		} else {
			setError(result.error ?? "Failed to start Google sign-in");
		}
		setLoading(false);
	}, [authService]);

	const handleSignOut = useCallback(async () => {
		if (!authService) return;
		setLoading(true);
		await authService.signOut();
		setAuthState({ user: null, session: null, isAuthenticated: false });
		setLoading(false);
	}, [authService]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter") handleMagicLink();
		},
		[handleMagicLink],
	);

	if (checking) return null;
	if (!authService) return null;

	if (authState?.isAuthenticated) {
		return (
			<FormCard title="Account">
				<FormField name="Signed in" description={authState.user?.email ?? ""}>
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={handleSignOut}
						disabled={loading}
					>
						Sign out
					</Clickable>
				</FormField>
			</FormCard>
		);
	}

	return (
		<FormCard title="Account">
			<Clickable
				class="mod-cta ep-btn ep:w-full ep:justify-center"
				onClick={handleGoogle}
				disabled={loading}
			>
				Sign in with Google
			</Clickable>

			<div class="ep:flex ep:items-center ep:gap-3 ep:my-2">
				<div class="ep:flex-1 ep:h-px ep:bg-obs-border" />
				<span class="ep:text-obs-muted ep:text-ui-smaller">or</span>
				<div class="ep:flex-1 ep:h-px ep:bg-obs-border" />
			</div>

			<FormField
				name="Email"
				description="Sign in with a magic link — no password needed"
			>
				<TextInput
					value={email}
					onChange={(v) => {
						setEmail(v);
						setMagicLinkSent(false);
					}}
					type="email"
					placeholder="email@example.com"
					class="ep:w-[260px]"
					autoComplete="email"
					onKeyDown={handleKeyDown}
				/>
			</FormField>

			{magicLinkSent && (
				<InfoBlock>Check your email for a sign-in link.</InfoBlock>
			)}

			{error && (
				<p class="ep:text-obs-error ep:text-ui-smaller ep:m-0">{error}</p>
			)}

			<Clickable
				class="ep-btn ep-btn-outline"
				onClick={handleMagicLink}
				disabled={loading || !email}
			>
				{magicLinkSent ? "Resend magic link" : "Send magic link"}
			</Clickable>
		</FormCard>
	);
}
