# Asset Labels

Printtool voor de asset-labels van KOEL Retail (57 × 31 mm) op de **Zebra ZD500R**.
Vervangt het oude Windows-tooltje `Asset_labels`.

**Gebruiken:** open de site, vul Article / Description / Serial number in, klik **Print Label**.
Je hoeft niets te installeren.

## Waarom dit werkt zonder server

De pagina is volledig statisch. De ZPL wordt in **jouw browser** opgebouwd en rechtstreeks
naar de mini-webserver in de printer gestuurd (`POST http://<printer-ip>/pstprnt`).

Daaruit volgen twee dingen die je moet weten:

1. **Je moet op het kantoornetwerk zitten.** De printer heeft een privé-adres
   (`10.2.10.26`) dat alleen binnen dat netwerk bestaat. Thuis werkt printen niet —
   de pagina laadt wel, maar de printer is onbereikbaar.
2. **Chrome vraagt eenmalig toestemming** om verbinding te maken met je lokale netwerk.
   Sta dat toe, anders gebeurt er niets. Werkt in Chrome en Edge; Safari en Firefox
   blokkeren dit soort verzoeken.

De printer stuurt geen antwoord terug dat de browser mag lezen. Daarom zegt de app
*"Verstuurd"* en niet *"Gelukt"* — of het label er echt uit komt, zie je aan de printer.

## Het label

| Regel | Inhoud |
|---|---|
| Art : | korte artikelcode als **Code 39**-barcode |
| | omschrijving als platte tekst, breekt over max. 2 regels |
| SN : | serienummer als tekst |
| | serienummer als **Code 39**-barcode |

**De leidende "S" gaat eruit.** Scan je Apple's serial dan krijg je `SFFMH82YSPLJQ`
binnen, terwijl het echte serienummer `FFMH82YSPLJQ` is — die `S` is een prefix van de
scanner. De app haalt hem weg uit zowel de tekst als de barcode. Uit te zetten met het
vinkje.

**Barcodes passen zich automatisch aan.** Korte codes krijgen dikke balken (makkelijker
scannen), langere worden smaller tot de ondergrens van 0,25 mm. Past het niet meer, dan
krijg je een foutmelding met het maximum in plaats van een barcode die niet scant.
Op 57 mm is dat ruim 11 tekens naast "Art :".

Een productnaam hoort dus **niet** in Article: "Nike Apple iPhone SE 64GB Black" zou als
Code 39 zo'n 107 mm breed worden. Korte code in Article, naam in Description.

## Andere printer

Onder **Instellingen** kun je het IP-adres wijzigen. Dat wordt in je browser onthouden,
dus het staat niet in de code.

## Bestanden

| | |
|---|---|
| `index.html` | formulier, voorbeeldweergave en bediening |
| `label.js` | bouwt de ZPL en tekent het voorbeeld (dezelfde layout-getallen voor allebei) |
| `print.js` | stuurt de ZPL naar de printer |

Geen build-stap, geen dependencies. Aanpassen = bestand bewerken, committen, pushen.
