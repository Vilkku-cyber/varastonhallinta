# Toteutettu alpha ja seuraavat portit

9.9.2026, käyttäjän uuden rajauksen jälkeen. Tämä dokumentti korvaa aiempien suunnitelmien Firebase Functions -oletuksen.

## Päiväkohtainen saatavuus

Varaus sisältää alku- ja loppupäivän. Maanantain keikka ei varaa tiistain saldoa. Jos uusi keikka kestää ma-ti, sen saatavuus määräytyy kummankin päivän yhteisestä vapaasta kapasiteetista eli varauskuorman huipusta. Esimerkkitesti: kokonaismäärä 10, ma 6, ti 6 → uudelle ma-ti-varaukselle 4 vapaata.

Jo pakattu tulevan keikan laite ei tee siitä varattua kaikille tuleville päiville. Aidosti myöhästynyt palauttamaton kalusto vähentää tämän päivän ja tulevien päivien saldoa. Fyysinen pakkaus tarkistaa myös, ettei laite ole vielä toisella keikalla. Peräkkäinen varaus on siis mahdollinen; fyysinen uudelleenpakkaus edellyttää edellisen lainan palautusta.

Saatavuus, pakkaus, palautus ja keikkalista käyttävät samaa domain-mallia. Palautettu/peruttu/luonnos ei varaa suunnittelukapasiteettia. Huolto vähentää kapasiteettia. Tuonnin määräristiriidat estävät uuden varaamisen kyseiselle tuotteelle, kunnes tiedot on vahvistettu.

## Functionsista riippumaton tallennus

`Repository`-rajapinnan takana on kaksi toteutusta:

1. **LocalRepository**: IndexedDB, yksi readwrite-transaktio koko komennolle, ilmoitus välilehdille BroadcastChannelilla. Tiedot säilyvät selaimen sulkemisen yli. Eri selaimet, localhost/127.0.0.1-osoitteet ja koneet ovat eri työtiloja. Tämä on oletus eikä se tee verkkotallennuksia.
2. **FirebaseRepository**: Firebase Auth ja RTDB `runTransaction` polussa `avArsenalV2/state`. Sama komentofunktio ajetaan transaktion sisällä; uudelleenyritys tarkistaa saatavuuden uusimmasta aineistosta. Optimistista paikallista onnistumista ei näytetä. Ei firebase/functions-importtia, Functions SDK -pakettia, Functions-julkaisua tai siihen sidottua backendia.

Komentotunnus on yhden kutsun ajan pysyvä ja kuitit estävät saman tunnuksen toistamisen. Keikan version tarkistus hylkää vanhaksi jääneen lomakkeen. Paikallisen adapterin kahden samanaikaisen tietokantayhteyden testissä viimeisen 10 laitteen erän sai vain yksi keikka.

Kriittinen ero aiempaan palvelinsuunnitelmaan: liiketoimintavalidointi ajetaan nyt asiakkaalla. RTDB-sääntöluonnos rajaa pääsyn sallittuihin käyttäjiin ja tarkistaa perusrakennetta, mutta **ei todista kaikkia dynaamisia varaus-/pakkausinvariantteja pahantahtoista sallittua kirjoittajaa vastaan**. Kirjoittavan operator-käyttäjän on tässä mallissa oltava luotettu. Sääntöjä ei ole emulaattoritestattu tai julkaistu. Tätä ei esitetä aiemman auktoritatiivisen palvelimen turvallisuustason korvaajana.

Ennen yhteistä tuotantoa tarvitaan emulaattori/testiprojekti, sääntötestit, roolien vahvistus ja mahdollisesti tiukempi päivä-/yksilökohtainen kirjoitusmalli. Tämä voidaan toteuttaa ilman Functionsia; vaihtoehtona on myöhemmin erillinen oma palvelin, jos asiakkaan luottamusraja ei riitä. Olemassa olevaa Firebase-laskutusta tai tilausta ei muutettu.

## Nyt toteutettu rakenne

```text
src/domain/  model, calendar, commands, importLegacy, backup, planner, seed
src/data/    repository (IndexedDB), firebaseRepository
src/ui/      App, Views, TripEditor, ProductEditor, TripDetail, Scanner, styles
tests/       audit-export, domain, repository
tools/       audit-export, preview-import
firebase/    database.rules.json (julkaisematon luonnos)
```

Yksi package.json ja package-lock.json. React 19, Vite 8, TypeScript 7 ja Firebase 12 on asennettu tämän projektin sisään. Ulkoisia fonttipyyntöjä ei tarvita. Vanhaa projektia tai sen ympäristöasetuksia ei kopioitu/muutettu.

## Varmistettu

- TypeScript-tarkistus ja Vite-tuotantobuild läpäisty.
- 17 automaattista testiä läpäisty: varauspäivät, kuorman huippu, oman varauksen poissulku, epäonnistuneen muutoksen atomisuus, myöhästyneet lainat, duplikaatit, version tarkistus, sarjanumeron kilpailu, palautus, Pintaled, sparse-hyllytaulukot, kahden paikallisen yhteyden kilpailu ja varmuuskopion round-trip.
- Npm-asennuksen audit: 0 tunnettua haavoittuvuutta kyseisellä tarkistushetkellä.
- Selaimessa luotiin sarjanumerollisen näytön ja custom-adapterin keikka, pakattiin molemmat, lähetettiin, palautettiin ja suljettiin. Suljettu keikka löytyi arkistosta sivun uudelleenlatauksen jälkeen.
- Selaimen kalenterissa kaksi peräkkäistä 6/10 näyttövarausta näyttivät 4 vapaata kummallekin päivälle.
- Etusivun ulkoasu tarkistettiin työpöytäkoossa ja 390 × 844 -mobiilikoossa; mobiilivalikko toimii ja sivulla ei ollut vaakaylivuotoa.
- Todellisen JSON-exportin offline-esikatselu: 189 tuotetta, 124 keikkaa, 103 hyllypaikkaa, 264 sijoittelua. Suunnitelmarivien alkuperäinen yhteismäärä 6102 ja pakkausmäärä 3181 säilyivät; alkuperäinen JSON säilyy mukana. Tämä ei yksin todista täydellistä semanttista migraatiota.

## Vielä ennen vanhan version korvaamista

- Firebase Auth/RTDB emulaattorissa ja aidossa testiprojektissa, lukijoiden ja kirjoittajien säännöt, verkkokatkokset sekä kaksi eri fyysistä laitetta.
- Tuotannon osoite, käyttäjät ja oikeudet, tietoturvarajan hyväksyntä, backup/restore-harjoitus ja katkaisusuunnitelma. Tässä ei yhdistetty tuotantoon.
- Historiapoikkeamien ratkaiseminen. Tuonti säilyttää 378 tarkistusmerkintää. `manual-*`-riviä ei yhdistetä varastotuotteeseen nimiosuman perusteella. Epäselvä tuotu rivi on luettavissa mutta ei vielä operatiivisesti pakattavissa/palautettavissa.
- LED:n täydelliset asennus-, kaapeli- ja prosessoriprofiilit. Paneelit ja Pintaled ovat toimivia; muun kaluston automaattista siirtoa ei väitetä tehdyksi.
- Todellinen kameraluku puhelimella, USB-skanneri, paperitulosteen sivutus ja pitkät listat. Sarjanumeron tekstisyöttö on testattu selaimessa.
- Käyttöliittymän laajempi saavutettavuus, dialogien poikkeuspolut, arkiston sivutus ja datamäärien kuormamittaus. Nyt koko v2-state ladataan kerralla.
- Saldon vähennyksen vaikutus jo olemassa oleviin keikkoihin näkyy saatavuudessa, mutta erillinen puutteen hyväksyntätyönkulku ei ole valmis. Kadonneen laitteen lopullinen poikkeamakäsittely ei ole toteutettu.

Käyttäjän pyyntö aloittaa 2.0 on toteutettu ensimmäisenä paikallisesti kokeiltavana alpha-versiona. Tätä ei merkitä valmiiksi tuotantoversioksi tai täydelliseksi migraatioksi.
