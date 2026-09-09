> HISTORIALLINEN SUUNNITELMA: käyttäjä rajasi Firebase Functionsin pois 9.9.2026. Nykyinen toteutus ja sitä koskevat päätökset ovat tiedostossa [05-toteutus-ja-jatko.md](05-toteutus-ja-jatko.md). Alla olevia palvelinsuunnitelmia ei ole otettu käyttöön.

# AV-arsenal 2.0: kokonaisuussuunnitelma

## Tavoite ja rajaus

Uusi kokonaisuus rakennetaan kansioon `C:\Users\vilhe\Videos\AV-arsenal`. Vanha `varasto` toimii käyttäytymisen ja datan vertailulähteenä. Käyttäjän toive uudesta eheästä projektista ohjaa suunnittelua; PDF:n ehdotus vanhan projektin sisäisestä asteittaisesta refaktoroinnista on vertailuaineistoa.

2.0 sisältää kaikki nykyiset päätyönkulut: kirjautuminen, kalusto, yksilöt ja vauriot, keikat, saatavuus, pakkaus, palautus, QR-haku, hyllyt, kalenteri, arkisto, lähetyslista, tehtävät ja LED-suunnittelu. Laskutus, asiakasportaali, moniyrityspalvelu ja kokonainen offline-synkronointijärjestelmä eivät ole nykyisestä pyynnöstä johdettuja vaatimuksia.

Tämän vaiheen tulos on suunnitelma ja ajettava data-auditointi. Sovelluksen moduulit, palvelin, uudet riippuvuudet ja kirjoittava migraatio ovat seuraavien toimituserien työtä.

## Arkkitehtuuripäätökset

| Päätös | Perustelu | Seuraus |
|---|---|---|
| React + TypeScript + Vite | Vanha osaaminen ja komponenttimalli säilyvät; tyyppirajat ehkäisevät tietomallien sekoittumista | Uusi projekti, yksi riippuvuuksien juurihakemisto ja lockfile |
| Firebase Auth säilyy | Olemassa olevia käyttäjiä ei tarvitse vaihtaa uuteen kirjautumisjärjestelmään | Auth-käyttäjät ja käyttöoikeudet käsitellään erillään RTDB-exportista |
| Firebase RTDB säilyy ensisijaisena tietokantana | Nykyinen reaaliaikaisuus ja aineisto sopivat siihen; tietokantamoottorin vaihto kasvattaisi yhtäaikaista muutosta | Transaktiorajat suunnitellaan eksplisiittisesti |
| Kriittiset muutokset kulkevat palvelimen komentorajapinnan kautta | UI:n tarkistus ei estä kahta käyttäjää varaamasta samaa viimeistä laitetta | Firebase Functions -palvelin on ehdotus; laskutus ja alue tarkistetaan ennen käyttöönottoa |
| UI, sovelluspalvelut, domain ja Firebase-adapterit erotetaan | Sama saatavuus, pakkaustila ja planner-tulos kaikkialla | UI ei kutsu Firebase update/set -operaatioita suoraan |
| Yksi trips-kokoelma, arkisto on elinkaaren tila | Nykyinen kopioi-poista-arkistointi voi jäädä puoliväliin | Uusi arkistonäkymä kysyy suljettuja keikkoja; historialliset ID:t säilyvät |
| Fyysinen palautus erillään suunnitellusta loppupäivästä | Myöhässä oleva kalusto ei saa vapautua kalenterin perusteella | Saatavuus huomioi myös palauttamattoman kaluston |
| Useita hyllysijainteja sallitaan | Exportissa 14 tietueella useita sijainteja; kaikkia ei voi tulkita virheeksi | Yksi rakenteinen sijoittelumalli, ei yhtä pakollista merkkijonoa |

Firebase Functions on tietoinen lisäys PDF:n kevyempään malliin. Pelkkä repository-kerros tai atominen update ei riitä estämään kilpailevia varauksia. PostgreSQL olisi perusteltu vaihtoehto, jos yritysten, varastojen tai tapahtumamäärän kasvu tekisi yhteisestä RTDB-transaktiosta liian raskaan. Tällä aineistolla moottorin vaihdolle ei vielä ole osoitettua tarvetta. Palvelinrajapinta pitää myöhemmän vaihdon mahdollisena.

## Vastuurakenne

```text
apps/web/src/
  app/                 reititys, auth-provider, sovelluskehys
  features/
    dashboard/ inventory/ trips/ packing/ returns/
    locations/ calendar/ archive/ scanner/ planner/ tasks/
  components/          lomakekentät, dialogit, taulukot, tilaviestit
  data/                tilaukset, komentoclient, välimuistit
packages/domain/src/   saatavuus, tilasiirtymät, pakkaus, LED-laskenta
packages/contracts/    komentojen ja tallennettavan datan skeemat
functions/src/
  commands/            oikeudet, validointi, transaktiot, idempotenssi
  repositories/        Firebase Admin SDK ja tietokantapolut
tools/                 auditointi ja erillinen migraattori
tests/                 domain, säännöt, integraatio, E2E
docs/                  päätökset, tietomalli, julkaisuohje
```

Tämä on tavoiterakenne, ei väite jo toteutetuista kansioista. Moduulit luodaan toimivan pystysuuntaisen työnkulun mukana. Vanhaa Express/SQLite-prototyyppiä ei kopioida rinnakkaiseksi tietolähteeksi.

## Käyttökokemus

Päävalikko: Etusivu, Keikat, Kalusto, Varasto, LED-suunnittelu, Tehtävät. Kalenteri ja arkisto ovat keikkojen näkymiä. QR-haku löytyy pysyvästi yläpalkista. Puhelimella pakkaus ja palautus avautuvat yhdellä painalluksella keikkakortista.

Etusivu näyttää tänään lähtevät, pakattavat, palautettavat ja myöhässä olevat keikat. Keikan yhtenäisessä työtilassa ovat Tiedot, Kalusto, Pakkaus, Palautus ja Historia. Luonti ja muokkaus käyttävät samaa lomaketta: nykyisten reitti-/modaalivarianttien rinnakkaisuutta ei jatketa.

Kalustorivillä erotetaan kokonaismäärä, ajanjaksolle vapaa määrä, fyysisesti ulkona ja huollossa. Valittu aikaväli pysyy näkyvissä. Puutteesta kerrotaan määrä ja sitä aiheuttavat keikat. Tallennuksessa palvelin tarkistaa tilanteen uudelleen.

Pakkauksessa näkyvät suunniteltu, pakattu ja puuttuva määrä. Kamera ja USB-skannerin näppäimistösyöttö käyttävät samaa komentoa. Skannauksen onnistuminen kuitataan vasta palvelimen vahvistuksesta. Verkkokatkos näkyy selvästi eikä käyttöliittymä lupaa tallennusta. Skannaus ei avaa QR:n sisältämää URLia automaattisesti.

Muu tuote lisätään nimellä, määrällä ja huomiolla. Se voi olla ulkopuolinen tavara eikä vähennä oman varaston saldoa. Käsin pakattu oman varaston kaapeli on edelleen inventory-rivi: syöttötapa ja omistajuus ovat eri asioita.

Palautus käsittelee osapalautuksen, puuttuvan laitteen ja vaurion. Keikan sulkeminen edellyttää kaikkien ulkona olevien rivien käsittelyä. Vaurioitunut palautus siirtyy huoltoon, ei suoraan vapaaksi. Vanhojen arkistojen returned-lippua ei tulkita todisteeksi yksilöittäin tarkistetusta palautuksesta.

Hyllynäkymä säilyttää suunnan, välit ja tasot. Käsin lisätyt hyllytavarat näkyvät erillisinä hyllymerkintöinä, joista voi tehdä varsinaisen kalustotuotteen. Sijoittelu voi olla useassa paikassa; määrää ei keksitä, jos sitä ei ole kirjattu.

Tuloste käyttää tallennettua pakkaustilannetta, nimi- ja sarjanumerosnapshotteja sekä pysyvää dokumenttitunnusta. Samasta arkistokeikasta voi tulostaa saman tietosisällön tuotteen myöhemmästä nimenmuutoksesta riippumatta.

## Keskeiset ristivaikutukset

| Muutos | Päivitettävät kokonaisuudet yhdessä |
|---|---|
| Tuotteen tunniste/seurantatapa | kalusto, QR, pakkaus, arkistohaku, hyllyt, plannerin tuotemäppäykset |
| Keikan aikaväli tai määrä | saatavuus, kalenteri, pakkauspuutteet, varauslukot, mahdollinen jo pakattu kalusto |
| Muu tuote | keikkalomake, pakkaus, palautus, tuloste, arkistohaku; ei varastosaldon vähennystä |
| Huolto/vaurio | vapaa kapasiteetti, yksilön skannaus, tulevien varausten puutevaroitus |
| Hyllysiirto | hyllynäkymä, haku, tuotteen paikat ja pakkauksen keräilyohje |
| Keikan sulkeminen | aktiivinen lista, fyysiset lainat, kalenteri, historia ja dokumentit |
| Planner-asetuksen muutos | uudet suunnitelmat; aiemmin tallennettu suunnitelma säilyttää sääntöversionsa |

Tuotteita poistetaan käytöstä soft delete -tilalla. Historiaviittauksia ei katkaista. Pakatun rivin pienentäminen suunnitellun määrän yli vaatii näkyvän ristiriidan käsittelyn. Inventaarion kokonaismäärän vähentäminen ei saa hävittää ulkona olevia yksilöitä.

