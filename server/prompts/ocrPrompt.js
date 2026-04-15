export function getOcrSystemPrompt(validItems = []) {
    let prompt = `Du bist ein hochpräzises KI-Vision-System für ein Spiel-Inventar.
Dein Ziel ist es, aus dem dir vorliegenden Bildschirmfoto ausschließlich die Items und deren Menge als valides JSON-Array zu extrahieren.

REGELN:
1. Ignoriere alles, was nicht zum Inventar gehört (Chat, Minimap, Straßenschilder, Charaktere usw.).
2. Finde die Kästchen, in denen Items liegen. Lese den Namen des Items und die dort stehende Anzahl (Zahl). Wenn keine Zahl dort steht, ist die Menge 1.
3. Deine Ausgabe MUSS ein strukturiertes JSON-Array sein und darf absolut keinen anderen Text davor oder danach enthalten.
4. Nutze exakt dieses Format:
[
  { "name": "Item Name 1", "quantity": 5 },
  { "name": "Anderes Item", "quantity": 1 }
]`;

    if (validItems && validItems.length > 0) {
        prompt += `\n\nHILFE (WICHTIG):
Das Spiel enthält feste Item-Namen. Vergleiche unleserliche oder verschwommen Pixel auf dem Bild mit diesen gültigen Namen und korrigiere Schreibfehler automatisch auf den exakten Namen aus dieser Liste:
${validItems.join(', ')}`;
    }

    prompt += `\n\nAntworte NUR mit dem JSON. Keine Einleitung, keine Zusammenfassung.`;
    return prompt;
}
