# AV-arsenal 2.0 alpha

Ensimmäinen ajettava 2.0-toteutus. React + TypeScript + Vite, yhteinen domain-logiikka ja vaihdettava tallennuskerros. **Firebase Functionsia ei käytetä eikä aktivoida.**

## Käynnistä

Koneella on Node 26.3.0. Testit käyttävät Noden TypeScript-tukea; käytä Node >=22.18 (suositus nykyinen 24 LTS) ja npm.

```powershell
Set-Location C:\Users\vilhe\Videos\AV-arsenal
npm.cmd ci
npm.cmd run dev -- --port 4173
```

Avaa http://127.0.0.1:4173. Oletuksena avautuu paikallinen esimerkkityötila. Tiedot säilyvät selaimen IndexedDB:ssä, ja saman selaimen välilehdet päivittyvät BroadcastChannelin kautta. Paikallinen tila ei synkronoidu laitteiden välillä.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview -- --port 4173
```

Älä käynnistä preview- ja dev-palvelinta samaan porttiin. Kehityspalvelin on rajattu localhostiin.

## Toteutettu

- Etusivu, aktiiviset keikat ja arkisto; tuote- ja sarjanumerohaku historiasta.
- Keikkojen luonti ja muokkaus, inventory-rivit sekä vapaan tekstin muu tuote.
- **Päiväkohtainen saatavuus ja kalenteri.** Peräkkäisten päivien keikat voivat varata saman laitteen. Aikavälin saatavuus perustuu kuormituksen huippuun, ei eri päivien varausten summaan.
- Kaluston luonti/muokkaus, kategoriat, sarjanumerot, huoltotila ja useat hyllysijainnit.
- Sarjanumeropakkaus, käsin pakkaus, osapalautus, huoltoon palautus ja keikan sulkeminen. Tapahtumaloki.
- Kameran QR-lukija sekä käsin/USB-skannerilla syötetty sarjanumero. Kameran fyysistä toimintaa ei vielä todennettu.
- Tulostettava lähetyslista myös arkistokeikasta. Paperi-/PDF-tulosteen ulkoasua ei vielä renderöity erikseen.
- Hyllypaikkojen ja hyllymerkintöjen hallinta, haku ja yhteinen tehtävälista.
- Alkuperäinen varaston pohjakartta, hyllyjen tasot sekä tuote-, sarjanumero- ja hyllyosoitehaku. Hakutulos korostaa oikean hyllypaikan.
- LED-paneelimitoitus ja Pintaledin 0,5 m palojen siirto uudelle tai olemassa olevalle keikalle.
- Vanhan RTDB-exportin paikallinen tuontiesikatselu, tarkistusjono, 2.0-varmuuskopion vienti ja palautus. Alkuperäinen tuonti säilyy varmuuskopiossa.
- Valinnainen Firebase Auth + RTDB-adapteri erilliseen v2-polkuun, ilman Functions SDK:ta.

## Tietojen tuonti

Tiedot ja asetukset → Valitse JSON-export → tarkista yhteenveto → Ota esikatseltu aineisto paikalliseen käyttöön. Tuonti korvaa vain paikallisen työtilan. Vie nykyinen varmuuskopio ennen vaihtamista. Alkuperäistä lähdetiedostoa tai vanhaa Firebase-kantaa ei muuteta.

CLI-esikatselu ilman selainta tai verkkoyhteyttä:

```powershell
node tools/preview-import.ts "C:\Users\vilhe\Videos\varasto\tietokanta tuonti\varastosofta-default-rtdb-export.json" reports/private/uusi-esikatselu.json
npm.cmd run audit:export -- "C:\Users\vilhe\Videos\varasto\tietokanta tuonti\varastosofta-default-rtdb-export.json" reports/private/uusi-audit.json
```

Ulkoinen aineisto ja raportit ovat gitignoratussa reports/private-kansiossa. Älä julkaise niitä tai siirrä niitä public/dist-kansioon. CLI ei ylikirjoita olemassa olevaa tiedostoa.

Oikeasta exportista saatiin 189 tuotetta, 124 keikkaa, 103 hyllypaikkaa ja 264 sijoittelua. Alkuperäisten suunnitelmarivien määrien summa 6102 ja pakattujen määrien summa 3181 säilyivät. Tuonti sisältää 378 tarkistusmerkintää (useita samasta kohteesta), joita ei väitetä ratkaistuiksi.

## Tiedostot

- [Nykyinen toteutus ja rajat](docs/05-toteutus-ja-jatko.md)
- [Alkuperäinen kokonaisuussuunnitelma](docs/01-kokonaisuussuunnitelma.md)
- [Vanhan version kartoitus](docs/02-nykytila.md)
- [Alkuperäinen migraatiosuunnitelma](docs/03-tietomalli-ja-migraatio.md)
- [Riippuvuussuunnitelma](docs/04-riippuvuudet-ja-hyvaksynta.md)

`src/domain` sisältää testattavat säännöt, `src/data` paikallisen/Firebase-tallennuksen ja `src/ui` käyttöliittymän. `package-lock.json` lukitsee asennetut versiot. Fontit toimitetaan paikallisesti, ei Google Fonts -verkkopyyntöjä.

## Rajat ennen tuotantokäyttöä

Tämä on paikallisesti kokeiltava alpha. Vanhaa tuotantoa ei ole korvattu. Firebase-kirjautuminen, RTDB-säännöt ja kahden oikean verkkolaitteen kilpailutilanteet odottavat emulaattori-/testiprojektivarmistusta. Sääntöluonnos on tiedostossa firebase/database.rules.json; sitä ei ole julkaistu. Täydet LED-asennus-/kaapeli-/prosessoriprofiilit, historiapoikkeamien ratkaiseminen sekä tuotantoon siirto ovat vielä kesken. Katso tarkempi hyväksymislista toteutusdokumentista.
