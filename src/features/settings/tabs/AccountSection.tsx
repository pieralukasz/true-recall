import type { AuthState } from "@features/integration/services/sync/auth.service";
import { Clickable, FormCard, FormField, TextInput } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useEffect, useState } from "preact/hooks";

export function AccountSection() {
	const plugin = usePlugin();
	const authService = plugin.authService;

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
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
	}, [authService]);

	const handleSignIn = useCallback(async () => {
		if (!authService || !email || !password) return;
		setLoading(true);
		setError("");
		const result = await authService.signIn(email, password);
		if (!result.success) {
			setError(result.error ?? "Sign in failed");
			setLoading(false);
			return;
		}
		const state = await authService.getAuthState();
		setAuthState(state);
		setPassword("");
		setLoading(false);
	}, [authService, email, password]);

	const handleSignUp = useCallback(async () => {
		if (!authService || !email || !password) return;
		setLoading(true);
		setError("");
		const result = await authService.signUp(email, password);
		if (!result.success) {
			setError(result.error ?? "Sign up failed");
			setLoading(false);
			return;
		}
		const state = await authService.getAuthState();
		setAuthState(state);
		setPassword("");
		setLoading(false);
	}, [authService, email, password]);

	const handleSignOut = useCallback(async () => {
		if (!authService) return;
		setLoading(true);
		await authService.signOut();
		setAuthState({ user: null, session: null, isAuthenticated: false });
		setLoading(false);
	}, [authService]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter") handleSignIn();
		},
		[handleSignIn],
	);

	if (checking) return null;
	if (!authService) return null;

	if (authState?.isAuthenticated) {
		return (
			<FormCard title="Account">
				<FormField
					name="Signed in"
					description={authState.user?.email ?? ""}
				>
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
			<FormField name="Email" description="Your True Recall account email">
				<TextInput
					value={email}
					onChange={setEmail}
					type="email"
					placeholder="email@example.com"
					class="ep:w-[260px]"
					autoComplete="email"
					onKeyDown={handleKeyDown}
				/>
			</FormField>

			<FormField name="Password" description="Your account password">
				<TextInput
					value={password}
					onChange={setPassword}
					type="password"
					placeholder="Password"
					class="ep:w-[260px]"
					autoComplete="current-password"
					onKeyDown={handleKeyDown}
				/>
			</FormField>

			{error && (
				<p class="ep:text-obs-error ep:text-ui-smaller ep:m-0">{error}</p>
			)}

			<div class="ep:flex ep:gap-2 ep:mt-1">
				<Clickable
					class="mod-cta ep-btn"
					onClick={handleSignIn}
					disabled={loading || !email || !password}
				>
					Sign in
				</Clickable>
				<Clickable
					class="ep-btn ep-btn-outline"
					onClick={handleSignUp}
					disabled={loading || !email || !password}
				>
					Sign up
				</Clickable>
			</div>
		</FormCard>
	);
}
