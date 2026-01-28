/**
 * Authentication service using Supabase (Episteme Cloud)
 * Handles user login, signup, and session management
 *
 * Note: Credentials are hardcoded (SaaS model). The anon key is public
 * by design - security relies on RLS (Row Level Security) policies.
 */
import { createClient, SupabaseClient, User, Session } from "@supabase/supabase-js";
import { TRUE_RECALL_CLOUD } from "../../constants";

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

/**
 * Supabase authentication service for Episteme Cloud
 */
export class AuthService {
	private client: SupabaseClient;
	private supabaseUrl: string;
	private supabaseAnonKey: string;

	constructor() {
		// Use hardcoded Episteme Cloud credentials (SaaS model)
		this.supabaseUrl = TRUE_RECALL_CLOUD.supabaseUrl;
		this.supabaseAnonKey = TRUE_RECALL_CLOUD.supabaseAnonKey;
		this.client = this.createClient();
	}

	/**
	 * Create Supabase client with current credentials
	 */
	private createClient(): SupabaseClient {
		return createClient(this.supabaseUrl, this.supabaseAnonKey, {
			auth: {
				autoRefreshToken: true,
				persistSession: true,
				detectSessionInUrl: false,
			},
		});
	}

	/**
	 * Update Supabase credentials and reinitialize client
	 * Kept for potential future use (e.g., self-hosted option)
	 */
	updateCredentials(supabaseUrl: string, supabaseAnonKey: string): void {
		this.supabaseUrl = supabaseUrl;
		this.supabaseAnonKey = supabaseAnonKey;
		this.client = this.createClient();
	}

	/**
	 * Check if the service is properly configured
	 * Always true in SaaS model since credentials are hardcoded
	 */
	isConfigured(): boolean {
		return true;
	}

	/**
	 * Get current authentication state
	 */
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

	/**
	 * Get current user
	 */
	async getCurrentUser(): Promise<User | null> {
		const {
			data: { user },
		} = await this.client.auth.getUser();
		return user;
	}

	/**
	 * Sign up a new user with email and password
	 */
	async signUp(email: string, password: string): Promise<AuthResult> {
		const { data, error } = await this.client.auth.signUp({
			email,
			password,
		});

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, user: data.user ?? undefined };
	}

	/**
	 * Sign in with email and password
	 */
	async signIn(email: string, password: string): Promise<AuthResult> {
		const { data, error } = await this.client.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true, user: data.user ?? undefined };
	}

	/**
	 * Sign out the current user
	 */
	async signOut(): Promise<AuthResult> {
		const { error } = await this.client.auth.signOut();

		if (error) {
			return { success: false, error: error.message };
		}

		return { success: true };
	}

	/**
	 * Get the Supabase client instance
	 * Useful for other services that need direct access
	 */
	getClient(): SupabaseClient {
		return this.client;
	}
}
