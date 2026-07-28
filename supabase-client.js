import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Retrieve environment variables with fallback support for static local files
let supabaseUrl = '';
let supabaseAnonKey = '';

try {
    // Check if running under Vite/bundler
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    }
} catch (e) {
    // Suppress reference error if import.meta is not supported
}

// Fallback to window globals or localStorage for build-free local testing
if (!supabaseUrl) {
    supabaseUrl = window.VITE_SUPABASE_URL || localStorage.getItem("VITE_SUPABASE_URL") || '';
}
if (!supabaseAnonKey) {
    supabaseAnonKey = window.VITE_SUPABASE_ANON_KEY || localStorage.getItem("VITE_SUPABASE_ANON_KEY") || '';
}

// Validate and clean config URL
let client = null;
if (supabaseUrl && supabaseAnonKey) {
    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
    }
    if (cleanUrl.endsWith('/rest/v1')) {
        cleanUrl = cleanUrl.substring(0, cleanUrl.length - 8);
    }
    client = createClient(cleanUrl, supabaseAnonKey);
} else {
    console.warn("Supabase credentials missing. Local auth and cloud database will be inactive until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.");
}

export const supabase = client;

/**
 * Registra un nuevo usuario en Supabase
 * @param {string} email 
 * @param {string} password 
 */
export async function signUp(email, password) {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });
    if (error) throw error;
    return data;
}

/**
 * Inicia sesión de usuario con email/password
 * @param {string} email 
 * @param {string} password 
 */
export async function signIn(email, password) {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    return data;
}

/**
 * Cierra la sesión activa
 */
export async function signOut() {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/**
 * Obtiene la sesión actual
 */
export async function getSession() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session;
}

/**
 * Suscribe un manejador para cambios en el estado de autenticación
 * @param {function} callback 
 */
export function onAuthStateChange(callback) {
    if (!supabase) return () => {};
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
    return () => subscription.unsubscribe();
}

/**
 * Guarda una dosificación en la tabla saved_mixes
 * @param {Object} mixData 
 */
export async function saveConcreteMix(mixData) {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    
    // Check authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Debes iniciar sesión para guardar mezclas.");

    const { data, error } = await supabase
        .from('saved_mixes')
        .insert([
            {
                user_id: user.id,
                name: mixData.name,
                concrete_class: mixData.concrete_class,
                design_method: mixData.design_method,
                exposure_class: mixData.exposure_class,
                batch_volume: parseFloat(mixData.batch_volume),
                wc_ratio: parseFloat(mixData.wc_ratio),
                cement_base: parseFloat(mixData.cement_base),
                sieve_data: mixData.sieve_data,
                additives: mixData.additives,
                materials: mixData.materials
            }
        ])
        .select();

    if (error) throw error;
    return data;
}

/**
 * Obtiene todas las mezclas del usuario autenticado
 */
export async function getUserMixes() {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Debes iniciar sesión para cargar mezclas.");

    const { data, error } = await supabase
        .from('saved_mixes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Elimina una dosificación guardada
 * @param {string} mixId 
 */
export async function deleteMix(mixId) {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { error } = await supabase
        .from('saved_mixes')
        .delete()
        .eq('id', mixId);

    if (error) throw error;
}
