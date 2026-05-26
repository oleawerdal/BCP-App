# BCP-App – IKT-beredskap (ISO/IEC 27001 A.5.30)

En enkel, selvstendig web-app for å dokumentere virksomhetens IKT-beredskap
for forretningskontinuitet, i tråd med **ISO/IEC 27001:2022 Annex A 5.30**.
Appen utfyller en eksisterende beredskapsplan ved å koble forretningsprosesser
til IKT-systemer, fastsette gjenopprettingsmål og dokumentere planer og tester.

## Komme i gang

Åpne `index.html` i en nettleser. Ingen installasjon eller server kreves.
Klikk **«Last inn eksempeldata»** på forsiden for å se appen utfylt.

## Moduler

- **Oversikt** – beredskapsscore, mangler i BIA, beredskapsstatus for kritiske
  systemer (RTO, siste test, plan) og kommende/forfalte tester.
- **Prosesser** – forretningsprosesser med eier, kritikalitet og kobling til
  systemene som støtter dem.
- **Systemer** – applikasjoner, infrastruktur og tjenester. Viser automatisk
  *avledet RTO* fra det strengeste gjenopprettingsmålet til prosessene de støtter.
- **BIA** – Business Impact Analysis per prosess: MTPD, RTO, RPO og
  konsekvensvurdering (økonomi/omdømme/juridisk/drift).
- **Gjenopprettingsplaner** – IKT-kontinuitetsplaner med strategi,
  aktiveringskriterier, forutsetninger, kontakter og konkrete gjenopprettingssteg.
- **Tester & øvelser** – logg over type, omfang, resultat, funn og neste dato.

## Data og sikkerhetskopi

Alle data lagres lokalt i nettleseren (`localStorage`) – ingenting sendes til
en server. Bruk **Eksporter** for å laste ned alt som en JSON-fil
(sikkerhetskopi/deling), og **Importer** for å laste den inn igjen.

> Merk: Data ligger per nettleser og maskin. Husk å eksportere jevnlig.
> Dette er en enbruker-løsning uten innlogging eller delt database.

## Slik dekker appen A.5.30

| Krav i A.5.30 | Hvor i appen |
|---|---|
| Identifisere prosesser og IKT-avhengigheter | Prosesser + Systemer |
| Fastsette kontinuitetskrav (RTO/RPO/MTPD) | BIA |
| Definere gjenopprettingsstrategier og -planer | Gjenopprettingsplaner |
| Teste og øve på beredskapen | Tester & øvelser |
| Følge opp status og avvik | Oversikt |

## Filer

- `index.html` – struktur og menyer
- `css/styles.css` – utseende
- `js/store.js` – datalagring, lagring/henting, eksport/import
- `js/ui.js` – delte UI-hjelpere (modal, varsler, skjemafelt)
- `js/app.js` – visninger, skjemaer og navigasjon
