# Slum Warriors – Bot API Doku

Hey! Hier findest du alles, was du brauchst, um deinen Discord Bot an unser Lagersystem anzubinden. Die Doku ist in zwei Teile aufgeteilt: Oben eine Kurzfassung zum Weiterschicken, unten dann die Details.

---

## Kurzfassung zum Weiterschicken

> Kopier einfach den Block hier drunter und schick ihn an euren Bot-Dev:

---

**Hey, hier ist die Anbindung für die Lager-API von Slum Warriors:**

Wir haben eine REST API gebaut, über die euer Bot Produkte suchen kann (mit Autocomplete), Bestände abfragen und Sachen ein- und auslagern kann.

**Base URL:** `https://nochnaya.3r6nuss.de/api/bot`
**Auth:** Schick bei jedem Request den Header `Authorization: Bearer <API_KEY>` mit – den Key bekommst du von uns.
**Rate Limit:** 60 Requests pro Minute pro IP, sollte locker reichen.

**Das sind die Endpoints:**

| Methode | Endpoint | Was es macht |
|---------|----------|-------------|
| `GET` | `/api/bot/products?q=Suchbegriff` | Produkte suchen (max 25, perfekt für Autocomplete) |
| `GET` | `/api/bot/warehouses` | Alle Lager auflisten |
| `GET` | `/api/bot/inventory?warehouse_id=X&product_id=Y` | Bestand checken (Filter sind optional) |
| `POST` | `/api/bot/checkin` | Einlagern – Body: `{ warehouse_id, product_id, person_name, quantity }` |
| `POST` | `/api/bot/checkout` | Auslagern – Body: `{ warehouse_id, product_id, person_name, quantity }` |

Bei POST-Requests nicht vergessen: `Content-Type: application/json`. Antworten kommen immer als JSON zurück. Wenn was schiefgeht, kriegst du ein `{ "error": "..." }` Objekt. Mehr Details dazu findest du weiter unten.

---

## Wie die Authentifizierung funktioniert

Jeder API-Call braucht einen API Key im Header – ohne den geht nix:

```
Authorization: Bearer DEIN_API_KEY
```

Wenn der Header fehlt → `401`. Wenn der Key falsch ist → `403`. Ganz einfach.

---

## Rate Limiting

Damit niemand die API zuspammt, gibt's ein Limit:

- **60 Requests pro Minute** pro IP – das sollte für jeden Bot mehr als genug sein
- In jeder Response siehst du diese Header: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Wenn du drüber kommst, gibt's ein `429 Too Many Requests` mit einem `Retry-After` Header, der dir sagt, wie lange du warten musst

---

## Die Endpoints im Detail

### 1. Produkte suchen (Autocomplete)

```
GET /api/bot/products?q=Pist
```

| Parameter | Pflicht? | Was es macht |
|-----------|----------|-------------|
| `q` | Nein | Suchbegriff – sucht ähnliche Produktnamen. Ohne `q` kommen einfach die ersten 25 Produkte. |

**Antwort** (`200`):
```json
[
  { "id": 1, "name": "Pistole" },
  { "id": 2, "name": "Pistolenmunition" }
]
```

> **Tipp fürs Discord Autocomplete:** Ruf den Endpoint einfach bei jedem Tastendruck auf und nimm die Ergebnisse als Choices. Das passt perfekt, weil Discord eh maximal 25 Ergebnisse anzeigt.

---

### 2. Lager auflisten

```
GET /api/bot/warehouses
```

Gibt dir alle Lager zurück, die es gibt:

**Antwort** (`200`):
```json
[
  { "id": 1, "name": "Führungslager", "type": "leadership" },
  { "id": 2, "name": "Normales Lager", "type": "normal" },
  { "id": 3, "name": "Waffenlager", "type": "normal" }
]
```

---

### 3. Bestand abfragen

```
GET /api/bot/inventory?warehouse_id=2&product_id=1
```

Beide Filter sind optional – du kannst sie kombinieren oder ganz weglassen:

| Parameter | Was es filtert |
|-----------|---------------|
| `warehouse_id` | Nur Bestand aus diesem Lager |
| `product_id` | Nur Bestand für dieses Produkt |

Ohne Parameter kriegst du einfach den gesamten Bestand aller Lager.

**Antwort** (`200`):
```json
[
  {
    "warehouse_id": 2,
    "warehouse_name": "Normales Lager",
    "product_id": 1,
    "product_name": "Kokain",
    "quantity": 150
  }
]
```

---

### 4. Einlagern

```
POST /api/bot/checkin
Content-Type: application/json
```

**Was du im Body mitschicken musst:**
```json
{
  "warehouse_id": 2,
  "product_id": 1,
  "person_name": "MaxMustermann",
  "quantity": 50
}
```

| Feld | Typ | Pflicht? | Beschreibung |
|------|-----|----------|-------------|
| `warehouse_id` | number | Ja | In welches Lager soll's rein? |
| `product_id` | number | Ja | Welches Produkt? |
| `person_name` | string | Ja | Wer lagert ein? (fürs Log) |
| `quantity` | number | Ja | Wie viel? (muss > 0 sein) |

**Antwort** (`201`):
```json
{
  "success": true,
  "transaction_id": 142,
  "type": "checkin",
  "product": "Kokain",
  "warehouse": "Normales Lager",
  "quantity": 50,
  "new_stock": 200
}
```

---

### 5. Auslagern

```
POST /api/bot/checkout
Content-Type: application/json
```

**Body:** Genau dasselbe wie beim Einlagern.

**Antwort** (`201`): Auch dasselbe, nur mit `"type": "checkout"`.

Falls nicht genug auf Lager ist, kommt ein `400` zurück:
```json
{
  "error": "Insufficient stock. Available: 10"
}
```

---

## Fehler-Codes auf einen Blick

| Code | Was ist passiert? |
|------|-------------------|
| `400` | Irgendwas fehlt im Request oder ein Wert ist ungültig |
| `401` | Du hast den Authorization-Header vergessen |
| `403` | Dein API Key stimmt nicht |
| `404` | Das Produkt oder Lager gibt's nicht |
| `429` | Zu viele Requests – chill mal kurz |
| `500` | Server-Fehler auf unserer Seite |
| `503` | Bot API ist nicht konfiguriert (kein API Key auf dem Server hinterlegt) |

---

## Beispiele mit cURL

Falls du es schnell in der Kommandozeile testen willst:

```bash
# Produkte suchen
curl -H "Authorization: Bearer DEIN_API_KEY" \
  "https://nochnaya.3r6nuss.de/api/bot/products?q=Kok"

# Bestand checken
curl -H "Authorization: Bearer DEIN_API_KEY" \
  "https://nochnaya.3r6nuss.de/api/bot/inventory?warehouse_id=2"

# Einlagern
curl -X POST \
  -H "Authorization: Bearer DEIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"warehouse_id":2,"product_id":1,"person_name":"MaxMustermann","quantity":50}' \
  "https://nochnaya.3r6nuss.de/api/bot/checkin"

# Auslagern
curl -X POST \
  -H "Authorization: Bearer DEIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"warehouse_id":2,"product_id":1,"person_name":"MaxMustermann","quantity":10}' \
  "https://nochnaya.3r6nuss.de/api/bot/checkout"
```

---

## Beispiel: Discord.js Autocomplete

So könnte die Autocomplete-Integration in Discord.js aussehen:

```javascript
// Slash-Command Autocomplete Handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;

  if (interaction.commandName === 'lager') {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'produkt') {
      const res = await fetch(
        `https://nochnaya.3r6nuss.de/api/bot/products?q=${encodeURIComponent(focused.value)}`,
        { headers: { 'Authorization': 'Bearer DEIN_API_KEY' } }
      );
      const products = await res.json();
      await interaction.respond(
        products.map(p => ({ name: p.name, value: String(p.id) }))
      );
    }
  }
});
```

---

## ChatGPT Prompt für den Bot-Betreiber

> Du willst den Bot nicht selber coden? Kein Ding – kopier einfach den Prompt hier drunter und gib ihn ChatGPT oder einem anderen KI-Tool. Dann bekommst du fertigen Code, den du nur noch in deinen Bot einbauen musst.

---

````
Ich brauche für meinen bestehenden Discord.js Bot (v14) eine Lagerverwaltung über ein Embed-Panel mit Buttons. Der Bot soll sich mit einer externen REST API verbinden. Kein Slash-Command für jede Aktion – stattdessen ein fest gepostetes Embed mit Buttons.

## API-Details

**Base URL:** https://nochnaya.3r6nuss.de/api/bot
**Authentifizierung:** Jeder HTTP-Request braucht den Header `Authorization: Bearer <API_KEY>`. Der API Key wird aus einer Umgebungsvariable `LAGER_API_KEY` gelesen.
**Rate Limit:** 60 Requests pro Minute. Bei Überschreitung kommt HTTP 429.

## Verfügbare API-Endpoints

### 1. Produktsuche
- `GET /api/bot/products?q=<suchbegriff>`
- Gibt ein Array zurück: `[{ "id": 1, "name": "Kokain" }, ...]`
- Maximal 25 Ergebnisse
- Ohne `q` Parameter werden die ersten 25 Produkte zurückgegeben

### 2. Lager auflisten
- `GET /api/bot/warehouses`
- Gibt ein Array zurück: `[{ "id": 1, "name": "Führungslager", "type": "leadership" }, { "id": 2, "name": "Normales Lager", "type": "normal" }, ...]`
- `type` kann "leadership" (Führungslager) oder "normal" sein

### 3. Bestand abfragen
- `GET /api/bot/inventory` (optional: `?warehouse_id=X&product_id=Y`)
- Gibt ein Array zurück: `[{ "warehouse_id": 2, "warehouse_name": "Normales Lager", "product_id": 1, "product_name": "Kokain", "quantity": 150 }, ...]`
- Ohne Filter = gesamter Bestand aller Lager

### 4. Einlagern
- `POST /api/bot/checkin` mit JSON Body: `{ "warehouse_id": number, "product_id": number, "person_name": string, "quantity": number }`
- Response `201`: `{ "success": true, "transaction_id": 142, "type": "checkin", "product": "Kokain", "warehouse": "Normales Lager", "quantity": 50, "new_stock": 200 }`

### 5. Auslagern
- `POST /api/bot/checkout` mit JSON Body: `{ "warehouse_id": number, "product_id": number, "person_name": string, "quantity": number }`
- Response `201`: identisch zu Einlagern mit `"type": "checkout"`
- Fehler bei zu wenig Bestand: `400` mit `{ "error": "Insufficient stock. Available: 10" }`

### Fehler-Codes
- 400 = Fehlende Felder oder ungültige Werte
- 401 = Kein Auth-Header
- 403 = Falscher API Key
- 404 = Produkt oder Lager nicht gefunden
- 429 = Rate Limit überschritten

## Berechtigungen / Rollen-Konfiguration

Die API liefert für jedes Lager einen `type` zurück: `"leadership"` oder `"normal"`. Der Bot muss prüfen ob der Discord-User die richtige Rolle hat, bevor er Zugriff auf ein Lager gewährt.

**Erstelle eine Konfigurations-Sektion (z.B. oben im Code oder in einer Config-Datei) mit folgenden Werten, die der Bot-Betreiber selbst ausfüllen muss:**

```javascript
// ====== KONFIGURATION – BITTE ANPASSEN ======
const CONFIG = {
  // Discord Rollen-IDs die auf "leadership"-Lager zugreifen dürfen
  // (z.B. Führung, Admins etc.)
  LEADERSHIP_ROLE_IDS: [
    'HIER_ROLLEN_ID_1_EINFÜGEN',
    'HIER_ROLLEN_ID_2_EINFÜGEN',
  ],

  // Discord Rollen-IDs die auf "normal"-Lager zugreifen dürfen
  // (z.B. Mitglieder, Members etc.)
  NORMAL_ROLE_IDS: [
    'HIER_ROLLEN_ID_1_EINFÜGEN',
    'HIER_ROLLEN_ID_2_EINFÜGEN',
  ],
};
// =============================================
```

**Regeln:**
- User mit einer Rolle aus `LEADERSHIP_ROLE_IDS` dürfen auf **alle** Lager zugreifen (leadership + normal)
- User mit einer Rolle aus `NORMAL_ROLE_IDS` dürfen **nur** auf Lager mit `type: "normal"` zugreifen
- User **ohne** eine der konfigurierten Rollen bekommen eine ephemeral Fehlermeldung: "❌ Du hast keine Berechtigung, auf die Lagerverwaltung zuzugreifen."
- Die Rollenprüfung nutzt `interaction.member.roles.cache.has(roleId)` um zu checken ob der User die Rolle hat

## Gewünschter Ablauf: Embed-Panel mit Buttons

### Schritt 1: Panel erstellen per Slash-Command `/lager-panel`

Ein Admin-Only Slash-Command `/lager-panel` postet ein **permanentes Embed** in den aktuellen Channel. Das Embed soll schön gestaltet sein mit:
- **Titel:** "📦 Lagerverwaltung"
- **Beschreibung:** Kurze Info wie "Klicke einen Button um Waren ein- oder auszulagern, oder den Bestand abzufragen."
- **Farbe:** Eine ansprechende Farbe (z.B. Blau/Lila)
- **Footer:** "Slum Warriors Lagersystem"

**3 Buttons darunter (in einer ActionRow):**
- 📥 **Einlagern** (grüner Button, Custom ID: `lager_checkin`)
- 📤 **Auslagern** (roter Button, Custom ID: `lager_checkout`)
- 📊 **Bestand** (blauer Button, Custom ID: `lager_inventory`)

Dieses Embed bleibt permanent im Channel stehen und jeder kann die Buttons jederzeit klicken.

### Schritt 2: Button "Einlagern" oder "Auslagern" geklickt

Wenn jemand den Einlagern- oder Auslagern-Button klickt:

1. **Zuerst Berechtigungsprüfung:** Prüfe ob der User mindestens eine Rolle aus `LEADERSHIP_ROLE_IDS` oder `NORMAL_ROLE_IDS` hat. Wenn keine → ephemeral Fehler: "❌ Du hast keine Berechtigung, auf die Lagerverwaltung zuzugreifen." und abbrechen.
2. Der Bot ruft `GET /api/bot/warehouses` auf, um die verfügbaren Lager zu holen.
3. **Lager nach Berechtigung filtern:**
   - Hat der User eine Rolle aus `LEADERSHIP_ROLE_IDS` → Zeige **alle** Lager (leadership + normal)
   - Hat der User nur eine Rolle aus `NORMAL_ROLE_IDS` → Zeige **nur** Lager mit `type: "normal"`
4. Er antwortet **ephemeral** (nur für den Klicker sichtbar) mit einem **StringSelectMenu**, das die **gefilterten** Lager als Optionen enthält.
   - Label = Lagername (z.B. "Normales Lager")
   - Value = Lager-ID als String (z.B. "2")
   - Beschreibung = Lagertyp ("Führungslager" oder "Normales Lager")
   - Custom ID: `sw_lager_select_warehouse_checkin` oder `sw_lager_select_warehouse_checkout` (je nach Aktion)
   - Placeholder: "Wähle ein Lager..."

### Schritt 3: Lager ausgewählt → Modal öffnet sich

Nachdem ein Lager im Select-Menü gewählt wurde:

1. Ein **Modal** (Discord Modal / TextInput Form) wird geöffnet mit:
   - **Titel:** "📥 Einlagern" oder "📤 Auslagern"
   - **Feld 1 – Produkt** (required, short): Label "Produktname", Placeholder "z.B. Kokain, Pistole, Meth..."
   - **Feld 2 – Menge** (required, short): Label "Menge", Placeholder "z.B. 50"
   - Custom ID des Modals enthält die Aktion und Lager-ID, z.B. `lager_modal_checkin_2` (damit der Bot beim Submit weiß, welches Lager und welche Aktion)

### Schritt 4: Modal abgeschickt → API Call

Wenn der User das Modal abschickt:

1. Der Bot nimmt den eingegebenen Produktnamen und sucht per `GET /api/bot/products?q=<eingabe>` nach dem Produkt.
2. **Wenn genau 1 Treffer:** Direkt die Transaktion ausführen.
3. **Wenn mehrere Treffer:** Dem User eine ephemeral Nachricht mit einem StringSelectMenu zeigen, damit er das richtige Produkt auswählen kann. Nach der Auswahl die Transaktion ausführen.
4. **Wenn kein Treffer:** Ephemeral Fehlermeldung: "❌ Kein Produkt mit dem Namen '...' gefunden."

5. Transaktion ausführen:
   - Bei Einlagern: `POST /api/bot/checkin` mit `{ warehouse_id, product_id, person_name: interaction.user.username, quantity }`
   - Bei Auslagern: `POST /api/bot/checkout` mit gleichen Feldern

6. **Erfolgs-Embed** (ephemeral, grün bei Einlagern, orange bei Auslagern):
   - Titel: "📥 Erfolgreich eingelagert!" oder "📤 Erfolgreich ausgelagert!"
   - Felder: Produkt, Menge, Lager, Person, Neuer Bestand (aus `new_stock` der API Response)

7. **Fehler-Embed** (ephemeral, rot):
   - Titel: "❌ Fehler"
   - Beschreibung: Die error-Message aus der API Response

### Schritt 5: Button "Bestand" geklickt

Wenn jemand den Bestand-Button klickt:

1. **Zuerst Berechtigungsprüfung** (gleiche Logik wie bei Einlagern/Auslagern).
2. Zeige ein StringSelectMenu mit den **nach Berechtigung gefilterten** Lagern (geholt per `GET /api/bot/warehouses`), plus eine Extra-Option "Alle Lager" mit Value "all".
   - Bei "Alle Lager" soll nur der Bestand der Lager angezeigt werden, auf die der User auch Zugriff hat.
3. Nach Auswahl: `GET /api/bot/inventory?warehouse_id=X` aufrufen (oder ohne Filter bei "Alle Lager").
4. **Bestand-Embed** (ephemeral, blau) anzeigen:
   - Titel: "📊 Bestand – [Lagername]" oder "📊 Gesamtbestand"
   - Die Produkte als Feld-Liste: Jedes Produkt eine Zeile mit Name und Menge, z.B. `Kokain: **150**`
   - Nur Produkte mit Menge > 0 anzeigen
   - Wenn keine Bestände: "Keine Produkte auf Lager."
   - Bei sehr vielen Produkten (>25): Auf mehrere Embeds aufteilen oder in einem Code-Block formatieren

## Technische Anforderungen
- Verwende die native `fetch` API (Node 18+) für HTTP Requests, kein axios
- Fehlerbehandlung: Fange HTTP-Fehler ab und zeige dem User eine verständliche Nachricht
- Der API Key soll aus `process.env.LAGER_API_KEY` gelesen werden
- Erstelle den Code so, dass ich ihn einfach als neues Modul in meinen bestehenden Bot einfügen kann
- Alle Interaktions-Responses (außer das Panel selbst) müssen ephemeral sein
- Verwende Collector-Timeouts für Select Menus (z.B. 60 Sekunden), danach "Zeitüberschreitung" melden
- Schreibe mir auch den Code für die Slash-Command-Registrierung des `/lager-panel` Commands
- Achte darauf, dass Custom IDs eindeutig sind und keine Konflikte mit anderen Bot-Features verursachen (verwende ein Prefix wie `sw_lager_`)
````
