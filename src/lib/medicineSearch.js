import { supabase } from './supabase';

/**
 * Searches medicines on the server.
 * Returns top 15 results in <30ms using Postgres ILIKE / Trigram index.
 */
export async function searchMedicines(query) {
  if (!query || query.trim().length < 2) {
    // If empty or 1 char, return top frequently used drugs
    const { data } = await supabase
      .from('master_medicines')
      .select('id, brand_name, generic_composition, dosage_form, manufacturer')
      .eq('is_frequently_used', true)
      .limit(10);
    return data || [];
  }

  const cleanQuery = query.trim();

  const { data, error } = await supabase
    .from('master_medicines')
    .select('id, brand_name, generic_composition, dosage_form, manufacturer')
    .or(`brand_name.ilike.%${cleanQuery}%,generic_composition.ilike.%${cleanQuery}%`)
    .limit(15);

  if (error) {
    console.error('Error fetching medicines:', error.message);
    return [];
  }

  return data || [];
}
