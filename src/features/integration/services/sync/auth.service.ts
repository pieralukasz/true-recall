/**
 * Authentication service using Supabase (True Recall Cloud)
 *
 * Supports magic link (passwordless email) and Google OAuth.
 * Both use PKCE flow with a web intermediary:
 *   Plugin → Supabase → truerecall.app/auth/obsidian-callback?code=...
 *   → obsidian://true-recall-auth?code=... → plugin exchanges code for session
 *
 * Note: Credentials are hardcoded (SaaS model). The anon key is public
 * by design - security relies on RLS (Row Level Security) policies.
 */

import { TRUE_RECALL_CLOUD, TRUERECALL_WEB_URL } from "@shared/constants";
import {
	type AuthChangeEvent,
	createClient,
	type Session,
	type SupabaseClient,
	type User,
} from "@supabase/supabase-js";

// Supabase can't redirect to obsidian:// directly, so we use a web intermediary
// that passes the code through to the obsidian:// protocol handler
const AUTH_REDIRECT_URL = `${TRUERECALL_WEB_URL}/auth/obsidian-callback`;

export interface AuthState {
	user: User | null;
	session: Session | null;
	isAuthenticated: boolean;
}

export interface AuthResult {
	success: boolean;
	error?: string;
	user?: User;
}

export class AuthService {
	private client: SupabaseClient;
	private supabaseUrl: string;
	private supabaseAnonKey: string;

	constructor() {
		this.supabaseUrl = TRUE_RECALL_CLOUD.supabaseUrl;
		this.supabaseAnonKey = TRUE_RECALL_CLOUD.supabaseAnonKey;
		this.client = this.createClient();
	}

	private createClient(): SupabaseClient {
		return createClient(this.supabaseUrl, this.supabaseAnonKey, {
			auth: {
				autoRefreshToken: true,
				persistSession: true,
				detectSessionInUrl: false,
				flowType: "pkce",
			},
		});
	}

	updateCredentials(supabaseUrl: string, supabaseAnonKey: string): void {
		this.supabaseUrl = supabaseUrl;
		this.supabaseAnonKey = supabaseAnonKey;
		this.client = this.createClient();
	}

	isConfigured(): boolean {
		return true;
	}

	async getAuthState(): Promise<AuthState> {
		const {
			data: { session },
		} = await this.client.auth.getSession();
		return {
			user: session?.user ?? null,
			session: session,
			isAuthenticated: session !== null,
		};
	}

	async getCurrentUser(): Promise<User | null> {
		const {
			data: { user },
		} = await this.client.auth.getUser();
		return user;
	}

	async signInWithMagicLink(email: string): Promise<AuthResult> {
		const { error } = await this.client.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: AUTH_REDIRECT_URL },
		});

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true };
	}

	async signInWithGoogle(): Promise<{ url: string } | AuthResult> {
		const { data, error } = await this.client.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: AUTH_REDIRECT_URL,
				skipBrowserRedirect: true,
			},
		});

		if (error || !data.url) {
			return {
				success: false,
				error: error?.message ?? "No auth URL returned",
			};
		}

		return { url: data.url };
	}

	async exchangeCodeForSession(code: string): Promise<AuthResult> {
		const { data, error } = await this.client.auth.exchangeCodeForSession(code);

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, user: data.user ?? undefined };
	}

	onAuthStateChange(
		callback: (event: AuthChangeEvent, session: Session | null) => void,
	): { unsubscribe: () => void } {
		const { data } = this.client.auth.onAuthStateChange(callback);
		return { unsubscribe: () => data.subscription.unsubscribe() };
	}

	async signOut(): Promise<AuthResult> {
		const { error } = await this.client.auth.signOut();

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true };
	}

	getClient(): SupabaseClient {
		return this.client;
	}
}
