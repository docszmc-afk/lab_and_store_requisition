import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aikvhlmvxxlilhdeiyiz.supabase.co';
const supabaseKey = 'sb_publishable_c-GtzjphsMRy3RbK49-lGA_tyM41_PG';

export const supabase = createClient(supabaseUrl, supabaseKey);