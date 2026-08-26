import { supabase } from './supabase';

/**
 * Searches lab tests and normal reference ranges.
 * Returns top matches or frequently ordered panels.
 */
export async function searchLabTests(query) {
  if (!query || query.trim().length < 2) {
    const { data } = await supabase
      .from('master_lab_tests')
      .select('*')
      .eq('is_frequently_ordered', true)
      .limit(12);
    return data || [];
  }

  const cleanQuery = query.trim();

  const { data, error } = await supabase
    .from('master_lab_tests')
    .select('*')
    .or(`test_name.ilike.%${cleanQuery}%,category.ilike.%${cleanQuery}%`)
    .limit(10);

  if (error) {
    console.error('Error searching lab tests:', error.message);
    return [];
  }

  return data || [];
}
