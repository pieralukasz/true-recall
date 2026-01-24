/**
 * Authentication service using Supabase
 * Handles user login, signup, and session management
 */
import { createClient, SupabaseClient, User, Session } from "@supabase/supabase-js";

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
 * Supabase authentication service
 */
export class AuthService {
	private client: SupabaseClient | null = null;
	private supabaseUrl: string;
	private supabaseAnonKey: string;

	constructor(supabaseUrl: string, supabaseAnonKey: string) {
		this.supabaseUrl = supabaseUrl;
		this.supabaseAnonKey = supabaseAnonKey;
		this.initializeClient();
	}

	/**
	 * Initialize or reinitialize the Supabase client
	 */
	private initializeClient(): void {
		if (this.supabaseUrl && this.supabaseAnonKey) {
			this.client = createClient(this.supabaseUrl, this.supabaseAnonKey, {
				auth: {
					autoRefreshToken: true,
					persistSession: true,
					detectSessionInUrl: false,
				},
			});
		} else {
			this.client = null;
		}
	}

	/**
	 * Update Supabase credentials and reinitialize client
	 */
	updateCredentials(supabaseUrl: string, supabaseAnonKey: string): void {
		this.supabaseUrl = supabaseUrl;
		this.supabaseAnonKey = supabaseAnonKey;
		this.initializeClient();
	}

	/**
	 * Check if the service is properly configured
	 */
	isConfigured(): boolean {
		return this.client !== null;
	}

	/**
	 * Get current authentication state
	 */
	async getAuthState(): Promise<AuthState> {
		if (!this.client) {
			return { user: null, session: null, isAuthenticated: false };
		}

		const { data: { session } } = await this.client.auth.getSession();
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
		if (!this.client) return null;
		const { data: { user } } = await this.client.auth.getUser();
		return user;
	}

	/**
	 * Sign up a new user with email and password
	 */
	async signUp(email: string, password: string): Promise<AuthResult> {
		if (!this.client) {
			return { success: false, error: "Supabase not configured" };
		}

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
		if (!this.client) {
			return { success: false, error: "Supabase not configured" };
		}

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
		if (!this.client) {
			return { success: false, error: "Supabase not configured" };
		}

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
	getClient(): SupabaseClient | null {
		return this.client;
	}
}
