> HISTORIALLINEN SUUNNITELMA: käyttäjä rajasi Firebase Functionsin pois 9.9.2026. Nykyinen toteutus ja sitä koskevat päätökset ovat tiedostossa [05-toteutus-ja-jatko.md](05-toteutus-ja-jatko.md). Alla olevia palvelinsuunnitelmia ei ole otettu käyttöön.

# Riippuvuudet, ympäristöt ja toimituserät

## Kone ja versioehdokkaat

Koneella tarkistettu Node 26.3.0 ja npm 11.16.0. Python/PDF-työkalut ovat käytettävissä Codexin runtime-paketissa. Java ei löytynyt PATHista. Gitin paikalliset lukukomennot toimivat, mutta HTTPS-helper puuttui käytetystä runtime-gitistä. GitHub-vertailu tehtiin onnistuneesti HTTP API:lla. Kokonaista kehitysympäristöä ei ole tämän perusteella vielä validoitu.

Npm-rekisteristä 9.9.2026 tarkistetut latest-versiot. Nämä ovat valintaehdokkaita, eivät vielä uuden sovelluksen asennettu tai yhdessä testattu lukittu riippuvuuspuu:

| Paketti | Rekisteriversio | Huomio |
|---|---|---|
| react / react-dom | 19.2.8 / 19.2.8 | parina; vanha React 18, vanhojen modaali-/datepicker-kirjastojen peer-tuki tarkistettava |
| vite | 8.2.2 | Node ^20.19 tai >=22.12; vanha 6.x |
| @vitejs/plugin-react | 6.1.1 | peer Vite ^8; optional compiler/Babel-peerit tarkistettava ennen asennusta |
| typescript | 7.0.2 | uusi projekti; työkalujen ja tyyppikirjastojen yhteensopivuus testattava |
| firebase | 12.18.0 | Auth/RTDB-moduulit; vanha 11.x; emulaattorit ja selaimet testattava |
| react-router-dom | 7.18.3 | uusi yksi reittipuu; vanhassa frontendissä 6.x, juuressa 7.x |
| vitest | 5.0.0 | Vite 6.4/7/8; Node 22.12/24/26 -tuki ilmoitettu |
| @playwright/test | 1.63.0 | Node >=20; selaimet ladattava varsinaista E2E-vaihetta varten |
| firebase-tools | 15.29.0 | emulaattorin Java-vaatimus ja Functions-runtime tarkistettava ennen lukitusta |

Kehityksen ja CI:n ensisijaiseksi Node-linjaksi suositellaan tuettua 24 LTS:ää. Tarkka korjausversio lukitaan toteutuksen alussa; palvelimen runtime valitaan Firebase Functionsissa tuetuista versioista erikseen. Konetta ei tässä vaiheessa päivitetty tai vaihdettu pois Node 26:sta.

Viralliset lähteet: [Node-julkaisulinjat](https://github.com/nodejs/Release), [Viten vaatimukset](https://vite.dev/guide/), [RTDB-luku ja kirjoitus](https://firebase.google.com/docs/database/web/read-and-write), [RTDB SDK:n transaktiohuomiot](https://firebase.google.com/docs/reference/js/database). Npm-versiot haettiin suoraan kunkin paketin registry.npmjs.org/latest-metadatasta.

## Päivitysmenetelmä

Yksi npm-workspace-juuri, yksi package-lock.json. Web, domain/contract ja Functions erotetaan työtiloiksi. Ei kopioida vanhaa node_modules-hakemistoa tai kumpaakaan vanhaa lockfilea uuteen. Lukitaan ensin Node ja minimipakettijoukko, asennetaan, korjataan peer-ristiriidat ja ajetaan typecheck, domain-testit ja build. Vasta sen jälkeen lisätään kalenteri, skannaus ja testityökalut.

Axios ei ole tarpeen ilman osoitettua tarvetta; HTTP-komennot voidaan toteuttaa natiivilla fetchillä tai Functions-clientilla. SQLite/Express, suora esbuild-pinni, vanhat React-modal/datepicker-riippuvuudet eivät siirry oletusarvoisesti. Date-only-malli ja dialogien saavutettavuus ratkaistaan ennen widget-valintaa. Fuse voidaan säilyttää vasta hakutarpeen perusteella. QR-kirjasto valitaan todellisilla puhelimilla tehdyn kokeen jälkeen; USB-skannerin tekstisyöttö toimii erillisenä varareittinä.

`npm audit` ajetaan lukitulle uudelle puulle ja havainnot arvioidaan niiden käyttökohdan mukaan. `npm audit fix --force` ei ole päivityssuunnitelma. Dependabot/Renovate voidaan ottaa käyttöön pienille erille, kun CI on olemassa. Tämä suunnittelupohja ei sisällä ulkoisia npm-riippuvuuksia, joten sille ei tarvita asennuksia.

Ympäristöt: paikallinen emulator (demo-project ID, ei tuotantotunnuksia), testiprojekti (omat Auth-käyttäjät), tuotanto. Webille vain nimetyt julkiset Firebase-asetukset; palvelinavaimia ei VITE_-muuttujiin. CI käyttää vähimpiä oikeuksia. Vercel-rewrite löytyy vanhasta frontendistä, mutta julkaisuvalintaa tai nykyistä tuotantohostia ei päätellä tästä yksin. Hosting-palvelu valitaan toteutuksen julkaisuvaiheessa. Functions-kustannukset ja nykyinen Firebase-tilaus on vielä tarkistettava.

## Toimituserät ja valmistumisen määritelmä

| Erä | Sisältö | Portti seuraavaan |
|---|---|---|
| 0: lähtökuva | nykytilakartta, vientiaudit, arkkitehtuuri | valmis tässä kansiossa; liiketoimintapoikkeamat kirjattu |
| 1: tekninen perusta | workspace, React/TS, auth, emulaattori, säännöt, CI, yhteiset virhetilat | puhdas npm ci + typecheck/test/build; luvaton käyttö estyy myös suoraan tietokantaan |
| 2: data ja luku | normalisoija, mapping, kaluston/keikkojen lukunäkymät | koko export näkyy ilman kadonneita rivejä; täydellinen round-trip-vertailu |
| 3: keikan ydin | luonti/muokkaus, custom, aikavälisaatavuus, palvelinkomennot | kaksi samanaikaista varausta eivät ylivaraa; oma vanha varaus ei vähennä kahdesti |
| 4: operatiivinen työ | QR, määrät, pakkaus, osapalautus, huolto, tuloste | kahden laitteen pakkaus, duplikaattiskannaus, verkkovirhe ja uudelleenyritys toimivat |
| 5: varasto ja historia | yksilöt, sijoittelu, hyllyhaku, kalenteri, arkisto, tehtävät | saman paikan tieto kaikissa näkymissä; vanha historia ja tuloste säilyvät |
| 6: LED | puhdas laskenta, profilet, tuoteroolit ja keikalle siirto | käsin tarkistetut vertailut; mitään tuotetta ei katoa siirrossa |
| 7: käyttöönotto | mobiili/saavutettavuus, kuorma, backup/restore, viimeinen migraatio | hyväksymislista läpi, tuotantoasetukset todennettu, rollback harjoiteltu |

Erät ovat toteutusjärjestys, eivät aikataululupaus. Eriytetty suunnittelu ei tarkoita puolen sovelluksen julkaisemista: 2.0 korvaa vanhan vasta ominaisuusporttien täytyttyä.

## Välttämättömät testit

- Saatavuus: päällekkäiset ja peräkkäiset varaukset, samana päivänä vaihtuminen, kapasiteetin huippu, muokattavan keikan poissulku, custom-rivit, peruttu/arkistoitu, huolto ja myöhästynyt palautus. Testissä 10 yksikköä ja peräkkäiset 6+6 varaukset jätetään 4 vapaaksi.
- Kilpailu: kaksi asiakasta varaa viimeisen yksikön; vain toinen onnistuu. Monituotekeikan epäonnistuminen ei jätä osavarausta. Duplikaatti commandId ei lisää saldoa. Sama ID eri sisällöllä hylätään. expectedVersion estää vanhan lomakkeen ylikirjoituksen.
- Pakkaus/palautus: sama sarja kahdesti, sama sarja toiselle keikalle, huoltoyksilö, tuntematon QR, muutos toisella puhelimella, verkkokatkos kuittauksen kohdalla, osapalautus, kadonnut laite, puutteen käsittely ennen sulkemista.
- Migraatio: array/object, nested manualItems, manual-oman-varaston-rivi, sama nimi eri tuotteilla, 155 sijaintitietuetta, keloja-tietue, monipaikkaisuus, null-aukoilla hyllytaulukot, puuttuva arkistotuote, yksilömääräristiriita, Helsingin päivä UTC-rajalla ja virheellinen aika. Lähde pysyy tavutasolla muuttumattomana.
- Säännöt: anonyymi, kirjautunut mutta ei sallittu, viewer, operator ja admin; roolin omatoiminen korotus estyy, suora operations-kirjoitus estyy, palvelin tarkistaa roolin. Käyttäjän deaktivointi katkaisee myös komento-oikeuden.
- LED: 1,0×0,25 → 1 pitkä, 1,5×0,25 → 1 pitkä + 1 lyhyt, 2,5×0,50 → 4 pitkää + 2 lyhyttä. Nolla/negatiivinen/NaN ei tuota kaapeleita. Yhteenveto ja keikan rivit identtiset. Puuttuva productId estää siirron. Pikselit lasketaan todellisista moduleista, ei sekoittaen 0,5 m ruudukon ja fyysisten palojen määrää.
- LED:n asennus- ja kaapelisäännöt: parillinen/pariton leveys, 3,5 m raja, yli 20 palan syötöt, pyöristykset, prosessorin rajakapasiteetti ja tuntematon kapasiteetti. Vanhan laskennan oletukset ovat vertailukohtia; valmistajatiedot ja oman kaluston käytännöt vahvistetaan ennen sääntöjen tuotantohyväksyntää.
- E2E: kirjautuminen → keikka kahdella inventory- ja yhdellä custom-rivillä → pakkaus → lähetyslista → palautus → arkistohaku. Sama puhelimella ja työpöydällä. Skanneri testataan kameran oikealla laitteella, ei pelkällä syötekenttätestillä.
- Käyttöliittymä: näppäimistö, dialogin fokus/palautus, selkeät tallennusvirheet, saavutettavat nimet, 390 px leveys, tulosteen sivutus ja pitkät nimet. Vanhan listan tapainen tuttu nopea työpolku säilyy.

## Avoimet liiketoimintavalinnat

Näillä on suunnitelmassa toimivat oletukset, mutta ne vahvistetaan ennen asianomaisen moduulin käyttöönottoa: päivävaraus vai kellonaikojen vaihto saman päivän sisällä; saako puutteen hyväksyä ja kuka; huolto/katoamiskäsittely; serial-tuotteiden kuuden määräristiriidan ratkaisut; hyllymerkintöjen luokittelu; vanhan allowedUsers-haaran avainten merkitys; Functions/hosting-kustannukset; LED-tuoteprofiilien tarkat valmistaja-arvot. Ne eivät estä projektipohjan tai offline-normalisoijan tekemistä.

