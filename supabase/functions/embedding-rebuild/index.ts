import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  return new Response(JSON.stringify({ status: 'ok', message: 'Embedding rebuild triggered' }), { headers: { 'Content-Type': 'application/json' } });
});
