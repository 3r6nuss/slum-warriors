export function getOcrSystemPrompt(validItems = []) {
    let prompt = `You are a highly precise Vision-AI for reading video game inventories from screenshots.
Your ONLY task is to extract all items and their quantities from the image and return a valid JSON array.

RULES:
1. Ignore everything that is not an inventory item (minimap, chat, roads, etc).
2. Look for square inventory slots. Read the ITEM NAME and the QUANTITY number. If no number is visible, assume quantity is 1.
3. You MUST output ONLY a structured JSON array of objects. Do not write any other text.
4. Use exactly this JSON structure:
[
  { "name": "Item Name 1", "quantity": 5 },
  { "name": "Another Item", "quantity": 1 }
]`;

    if (validItems && validItems.length > 0) {
        prompt += `\n\nCRITICAL HINT (USE FOR CORRECTIONS):
The game contains a strictly defined set of item names. You must match the blurry or hard-to-read text from the image against this exact list of valid item names. Always spell them exactly as they appear here:
${validItems.join(', ')}`;
    }

    prompt += `\n\nRemember: Output ONLY valid JSON array starting with '[' and ending with ']'. No markdown blocks, no code blocks, no explanations.`;
    return prompt;
}
