export async function embed(text: string | string[]): Promise<number[][]> {
  const url = process.env.EMBEDDING_INFERENCE_URL || 'http://localhost:8080/embed';
  const inputs = Array.isArray(text) ? text : [text];
  
  if (inputs.length === 0) return [];

  // Simple retry wrapper
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs })
      });
      
      if (!response.ok) {
        throw new Error(`Embedding failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.embeddings; // Expecting number[][]
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  
  return [];
}
