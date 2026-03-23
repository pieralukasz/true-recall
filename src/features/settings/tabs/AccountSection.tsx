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
		<FormCard
				title="Account"
				class="ep:!bg-obs-interactive-accent/10"
			>
			<InfoBlock>
				Sign in to your account to track your AI usage in the dashboard. More features coming soon — cloud sync, cross-device access, and automatic backups.
			</InfoBlock>
			<FormField
				name="Email"
				description="Sign in with a magic link — no password needed"
			>
				<div class="ep:flex ep:items-center ep:gap-2">
					<TextInput
						value={email}
						onChange={(v) => {
							setEmail(v);
							setMagicLinkSent(false);
						}}
						type="email"
						placeholder="email@example.com"
						class="ep:!w-[200px]"
						autoComplete="email"
						onKeyDown={handleKeyDown}
					/>
					<Clickable
						class="ep-btn ep-btn-outline ep:whitespace-nowrap"
						onClick={handleMagicLink}
						disabled={loading || !email}
					>
						{magicLinkSent ? "Resend link" : "Send link"}
					</Clickable>
					<div class="ep:w-px ep:h-5 ep:bg-obs-border" />
					<Clickable
						class="clickable-icon ep:flex ep:items-center ep:justify-center ep:rounded-md ep:w-8 ep:h-8 ep:hover:bg-obs-modifier-hover ep:transition-colors"
						onClick={handleGoogle}
						disabled={loading}
						aria-label="Sign in with Google"
					>
						<GoogleIcon />
					</Clickable>
				</div>
			</FormField>

			{magicLinkSent && (
				<InfoBlock>Check your email for a sign-in link.</InfoBlock>
			)}

			{error && (
				<p class="ep:text-obs-error ep:text-ui-smaller ep:m-0">{error}</p>
			)}
		</FormCard>
	);
}

function GoogleIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 48 48">
			<path
				fill="#EA4335"
				d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
			/>
			<path
				fill="#4285F4"
				d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
			/>
			<path
				fill="#FBBC05"
				d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"
			/>
			<path
				fill="#34A853"
				d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
			/>
		</svg>
	);
}
