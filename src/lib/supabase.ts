import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mxuzctxmflejdhnoleyx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14dXpjdHhtZmxlamRobm9sZXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzA4NzYsImV4cCI6MjA5NjUwNjg3Nn0.hcFfMZR9S5MvwVqhqRLZZkIwH2j2wvdcuD5iTvQub4U'

export const supabase = createClient(supabaseUrl, supabaseKey)
