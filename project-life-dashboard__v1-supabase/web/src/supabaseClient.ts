import { createClient } from '@supabase/supabase-js'

export type SupabaseConfig = {
	url: string
	anonKey: string
}

export const getEnvConfig = (): SupabaseConfig | null => {
	// Hardcoded values for Vercel deployment
	const url = 'https://jdsojjjrxsknffuogdux.supabase.co'
	const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkc29qampyeHNrbmZmdW9nZHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjEwNjMsImV4cCI6MjA4NjgzNzA2M30.zPPzQev60bopgiBlenNAezIsYfNg8m5IMAigfsDGIhs'

	if (!url || !anonKey) {
		return null
	}

	return { url, anonKey }
}

export const createSupabaseClient = (config: SupabaseConfig | null) => {
	if (!config) {
		return null
	}

	return createClient(config.url, config.anonKey)
}

