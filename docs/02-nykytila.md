# Tarkistettu nykytila 9.9.2026

## Lähteet ja varmuus

- Paikallinen `C:\Users\vilhe\Videos\varasto`, HEAD `a515d21`, 20.8.2025. Käyttäjän paikallisia muutoksia on ShelfAdmin.jsx- ja firebaseConfig.js-tiedostoissa.
- GitHub API: main `dc683d1c15c231f352fe5dee74499342f5f70aa2`, kaksi committia edellä. Erot: lokituksen rajaus ja avainhallinnan ohjeet. Vertailu onnistui HTTP API:lla; paikallisen gitin HTTPS-helper ei toiminut.
- Käyttäjän nimeämä RTDB-export, rakenteellisesti auditoitu kokonaan. Tämä ei ole live-kannan tilannevahvistus.
- PDF:n kaikki 18 sivua luettiin tekstinä ja To Do -kuvan sivu tarkastettiin renderöitynä. PDF on lähde, ei käyttäjän puolesta annettu tuotantomuutosvaltuutus.
- Tuotannon RTDB-sääntöjä, Firebase Authin käyttäjälistaa ja julkaisualustan asetuksia ei ollut mukana. Sääntötiedostoa ei löytynyt paikallisesta projektista. Käyttöoikeuksien toimivuutta ei voi päätellä kirjautumisnäkymästä.

## Ominaisuuskartta

| Vanha toteutus frontend/src/ | Säilytettävä toiminta | 2.0-korjaus |
|---|---|---|
| App, ProtectedRoute, Login | kirjautuminen, salasanan palautus, suojatut reitit | yksi auth-tilaus, odotus- ja oikeusvirhetilat, palvelinvaltuutus |
| Home | aktiiviset keikat ja työvaihevärit | operatiivinen koonti ja yhtenäiset tilanimet |
| Inventory, ProductModal, AddProductModal | kategoriat, haku, määrät, mitat, lisätiedot, yksilöiden vauriot | yksi tuotemalli ja UnitManager; vapaa määrä erillään kokonaismäärästä |
| CreateTrip, EditTrip ja modaalit | kalustolista, yhteyshenkilö, ajat, palautus/poisto | yksi lomake, aikavälisaatavuus, eheät tilasiirtymät |
| Pakkaus, SimpleQRScanner | kamera, sarjanumerosyöttö, käsin pakkaus, määrän oikaisu | komentokohtainen tallennus ja samanaikaisuuden hallinta |
| QRCodeReader | yksilön ja sijainnin haku | jaettu hakuindeksi ja skannauspalvelu |
| ShelfAdmin, ShelfMap, ShelfSearch, VisualShelfView, MiniMap | hyllyt, välit, tasot, suunnat, visuaalinen haku | sijoittelu ja hyllymerkinnät erilleen tuotteista |
| Calendar, PastTrips | kalenteri, historia, tuote- ja sarjanumerohaku | yhtenäiset aikavälit, snapshotit, sivutettu historia |
| helpers/PrintPackingList | pakkauslista, brändi, paperitulostus | myös arkistosta, pysyvä dokumenttitunnus |
| LedPlanner | paneelit, mitoitus, asennus, kaapelit, prosessori, lisäys keikalle | versioidut laskentasäännöt ja eksplisiittiset tuotemäppäykset |
| ToDo | yhteinen luonti, muokkaus, kuittaus ja poisto | säilytetään tehtävämoduulina |

## Konkreettiset koodihavainnot

1. **Pintaled katoaa keikalta.** LedPlannerin summaryItems antaa molemmille pintaled-osille `id:null`, ja initialItemsForTrip suodattaa ne pois. Koskee sekä uuden keikan luontia että vanhalle lisäämistä.
2. **Saatavuus ei perustu aikaväliin.** Inventory ja CreateTrip summaavat kaikki aktiiviset keikat. CreateTripin varauslaskureiden object spread korvaa saman tuotteen globaalin määrän paikallisella.
3. **Pakkaus on ylikirjoitusaltis.** Pakkaus muuttaa React-tilaa paikallisesti ja tallentaa kokonaisen packedItems-objektin. Reaaliaikainen tilaus voi lisäksi korvata tallentamattoman paikallisen tilan. Plannerin get + merge + update sisältää vastaavan kilpajuoksun.
4. **Arkistointi ei ole yksi atominen operaatio.** EditTrip kopioi arkistoon ja poistaa aktiivisen erillisillä kutsuilla. Se ei varmista yksilökohtaista palautumista.
5. **Hyllymuutos voi luoda vajaan inventory-tietueen.** ShelfAdmin.addProduct käyttää annettua nimeä inventory-polun avaimena ja kirjoittaa vain shelfLocationin. Hyllystä poisto ei poista cachea. Automaattinen `Tuote 1` luodaan uusiin rakenteisiin.
6. **Kuuntelijoiden sulkeminen on epätasaista.** Pakkaus, Inventory ja Planner sulkevat useita tilauksiaan oikein; esimerkiksi CreateTrip, ShelfAdmin ja PastTrips eivät palauta kaikkien onValue-kutsujen sulkemista.
7. **Rakennuskonfiguraatio on kaksinkertainen.** Juuri ja frontend sisältävät eri router-, datepicker-, Vite- ja React-plugin-versioita. Juurikomennot ja README eivät yksiselitteisesti kuvaa todellista frontend-juurta.
8. **Viten process.env-mäppäys on liian laaja.** frontend/vite.config.js määrittää koko process.env:n. Uudessa toteutuksessa vain nimetyt julkiset VITE_-asetukset päätyvät selaimeen. Tästä havainnosta ei ole osoitettu toteutunutta salaisuusvuotoa.
9. **SQLite on eri toteutuspolku.** Tarkastetut frontend-moduulit käyttävät Firebasea suoraan. Vanha backend sisältää erillisen saldomallin ja prototyyppikoodia; sitä ei oteta uuden sovelluksen auktoriteetiksi.

## Exportin luvut

| Kohde | Määrä |
|---|---:|
| inventory-tietueet | 345 |
| Nimetyt tuotteet | 189 |
| Nimettömät tietueet | 156 |
| Näistä pelkkä shelfLocation | 155 |
| Muu nimetön tietue, kenttä keloja | 1 |
| Yksilöseurantaa sisältävät tuotteet | 60 |
| units-merkinnät | 182 |
| Aktiiviset keikat | 6 |
| Arkistoidut keikat | 118 |
| Hyllyt | 8 |
| Tehtävät | 5 |
| allowedUsers-merkinnät | 4 |

`allowedUsers` löytyi datasta, vaikka PDF:n haaralistassa sitä ei mainita. Arvot ovat boolean-arvoja. Avainmuoto ja vastaavuus Auth UID:ihin on selvitettävä erikseen; neljää merkintää ei voi tulkita automaattisesti neljäksi siirrettäväksi Auth-käyttäjäksi.

Auditin havaintomäärät eivät ole toisensa poissulkevia:

| Havainto | Määrä | Merkitys |
|---|---:|---|
| Hyllyviittaus ilman inventory-tietuetta | 14 | hyllymerkintä, poistettu tuote tai testimerkintä selvitettävä |
| Hyllyviittaus nimettömään tietueeseen | 153 | käsin lisätyn hyllymerkinnän mahdollinen vastinpari |
| Useita hyllypaikkoja | 14 | voi olla todellinen monipaikkaisuus |
| shelfLocation ilman vastaavaa paikkaa | 14 | ei saa valita cachea automaattisesti totuudeksi |
| Hyllypaikka ilman cachea | 1 | toinen suunta puuttuu |
| available eroaa units-määrästä | 6 | osittainen yksilörekisteri tai saldovirhe; ei automaattista leikkausta |
| Eri sisältö details/additionalInfo-kentissä | 7 | molemmat sisällöt säilytettävä |
| manual-avaimelliset pakkausrivit | 211 | eivät automaattisesti kaikki ole ulkopuolista tavaraa |
| Poikkeava sisäkkäinen pakkausrakenne | 1 | packedItemsin sisällä taulukko |
| Virheellinen aikaväli | 3 | kaikki arkistossa |
| Tuoteviite puuttuu nykyinventorysta | 1 | arkistossa; snapshot/tombstone tarpeen |

Arkiston items on 117 keikalla objekti ja yhdellä taulukko. Pakkaustieto puuttuu 57 arkistokeikalta ja kahdelta aktiiviselta. Puuttuva toteuma tarkoittaa tuntematonta historiaa, ei nollaksi todennettua pakkausta. PDF:n manualItems-kuvaus on tarkennettava myös sisäkkäiseen muotoon.

Auditointi ei vielä todista jokaisen rivin semanttista oikeellisuutta, sarjanumeron omistajuutta pakkaushetkellä, vaarattomuutta tai täydellistä migraatiovalmiutta. Raportin poikkeamat ovat käsiteltävä työjono, eivät syy poistaa lähdetietoa.
