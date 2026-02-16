import { createClient } from '@supabase/supabase-js'

export type SupabaseConfig = {
	url: string
	anonKey: string
}

export const getEnvConfig = (): SupabaseConfig | null => {
	const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
	const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

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
