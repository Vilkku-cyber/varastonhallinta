# Työaika AV Arsenal 2.0:ssa

Työaika avautuu sivuvalikosta ja käyttää olemassa olevaa kirjautumista sekä
Repository-tallennuskerrosta. Paikallisessa tilassa tiedot tallentuvat samaan
IndexedDB-työtilaan, verkkotilassa samaan `avArsenalV2/state`-transaktioon.
Firebase Functionsia tai toista Firebase-sovellusta ei lisätä.

`state.worktime.people` sisältää nimet ja `state.worktime.records[uid]`
käyttäjäkohtaiset merkinnät, ajastimen sekä alkuperäiset tiedot säilyttävän
muutoshistorian. Käyttäjä lisätään luetteloon hänen avatessaan työaikasivun.
Oletusvalinta on kirjautunut käyttäjä. Muut työtilan käyttäjät ovat valittavissa
kirjaamista ja tarkastelua varten. Oikeudet ovat samat kuin muussa yhteisessä
2.0-työtilassa: palvelimen nykyinen `allowedUsers`-lista. Erillistä roolirekisteriä
tai uusia tietokantasääntöjä ei tarvita. Työaika ei ole erillinen henkilöstöhallinnon
rajattu rekisteri; kaikki työtilaan hyväksytyt käyttäjät voivat käyttää sen tietoja.
Verkkoadapteri asettaa tapahtuman tekijän kirjautuneen session UID:stä.

Työajat sisältyvät työtilan varmuuskopiointiin ja palautukseen. Vanhan kaluston
tuonti säilyttää jo syntyneet työajat. Samanaikaiset muutokset tarkistetaan
sekä työtilan transaktiossa että merkinnän/ajastimen versioista.

Lomakkeessa on aloitus, lopetus, ruokailuvalinta, muistiinpano ja kopiointi.
Ruokailu työn ohessa ei vähennä aikaa. Varsinaisen vapaan ruokatauon kesto
annetaan erikseen ja vähennetään kerran. Kirjauksettomat
päivät tulkitaan vapaapäiviksi. Vanhat taukotiedot ja laskentatilannekuvat säilyvät.
Kuvassa ollut johdantolaatikko on poistettu. Laskentaperusteet ja pykälälinkit
ovat edelleen tulosten sekä historian yhteydessä.

Laskentaprofiili on yleistyöaika 8 h / 40 h, Helsinki, viikko ma–su. TES,
muut poikkeussopimukset ja neljän kuukauden enimmäistyöajan keskiarvon
varmistus ovat erillisiä tarkistuksia. Juhlapäiväkorotukset sisältyvät v5-profiiliin.
Laskennallinen korvausvapaa ei ole
automaattinen vahvistettu vapaasaldo. Tarkemmat säännöt ja lähdeversio tallentuvat
jokaisen laskelman yhteyteen (`src/worktime/rules.js`).

## Työaikasaldo ja vapaat (13.11.2026)

Etusivulla ja työaikasivun alussa on **Työajan tilanne**: jäljellä oleva
laskennallinen vapaasaldo, pidetyt vapaapäivät, tasaukseen käytetyt tunnit sekä
tehdyt tunnit suhteessa työaikatavoitteeseen. Vapaiksi tulkitaan kirjausmallin
mukaisesti päivät, joilla ei ole työtä. Tavalliset viikkovapaat ja työpäiville
osuvat vapaat näytetään erikseen.

Oletus on 40 h viikossa, ma–pe 8 h/päivä. Työntekijäkohtaisissa saldoasetuksissa
voi vaihtaa viikkotyöajan ja työpäivät, asettaa aloituspäivän ja alkusaldon.
Asetukset tallentuvat `records[uid].settings`-kenttään version tarkistavalla
työaikakomennolla; muutoksen vanhat/uudet asetukset ja laskelma säilyvät historiassa.
Oletuksena seuranta alkaa ensimmäisestä merkinnästä, joten sitä edeltäviä päiviä
ei veloiteta. Tyhjä aineisto ei tuota automaattista alijäämää.

Laskenta on: **alkusaldo + työpäiväkohtainen lisäaika + ylityön korotusosat −
lyhyiden tai vapaiden työpäivien alitus**. Sama tehty työtunti lasketaan vain
kerran. Korotusosana lisätään päivä-/viikkoylityön 50 % tai 100 %, sillä tunnin
perusosa on jo lisäajassa. Versiosta v5 alkaen myös sunnuntai- ja kansallisten
juhlapäivien 100 % korotusosa lisätään saldoon. Sama päivä lasketaan kerran.
Juhlapäivä ei muuta sovittua 40 h ma–pe -tavoitetta automaattisesti. Lyhyemmän
viikkotyöajan valinta muuttaa tavoitetta, mutta ei muuta yleistyöajan lakiperusteisia
8/40 h ylityörajoja. Saldo on sopimusperusteisen vapaaksi vaihtamisen arvio.

Esimerkkejä 40 h ma–pe -asetuksella:

- Normaali 40 h viikko ja la–su vapaa: saldo 0, kaksi viikkovapaata.
- Maanantai 10 h ja tiistai 6 h, muut arkipäivät 8 h: tuntiero 0, mutta 1 h
  ylityön korotusosaa jää vapaasaldoon.
- Normaali 40 h + lauantai 8 h: 12 h laskennallista saldoa (8 h + 4 h korotusosaa).
- Arkipäivä ilman kirjausta: 8 h käytetään saldosta; la–su ei kuluta saldoa.

Saldo voi mennä negatiiviseksi ja kantautuu viikkojen yli. Kirjausten korjaus,
poisto ja palautus laskevat saldon uudestaan; erillisiä kulutustapahtumia ei lisätä
uudelleen. Viikot ja päivät voi avata erittelyksi. Alkusaldo erotetaan tavallisesta
tehdyn ja tavoitellun ajan erotuksesta.

Tulevia päiviä, keskeneräistä tätä päivää tai avoimen vuoron päiviä ei veloiteta.
Tämä päivä sisältyy vasta valmiiden merkintöjen jälkeen. Vuosilomia, sairauspoissaoloja
ja muita poissaololajeja ei päätellä: tämän yksinkertaistetun kirjausmallin mukaan
kaikki työmerkinnättömät säännölliset työpäivät käyttävät saldoa. Erillistä
poissaolotyyppien palkka-/TES-laskentaa ei ole lisätty.

Sääntöversio on `fi-general-2026-11-19-v5`. Vanhoja merkintöjä, aikaleimoja tai
historian laskentatilannekuvia ei muuteta. Varmuuskopiointi sisältää myös asetukset.

## Ruokailu, lisät ja korvaavat levot (19.11.2026)

TES:iä ei käytetä. Päivä-/viikkoylityön sekä sunnuntai-/juhlapäivätyön korotusosat
kertyvät vapaasaldoon, rahakorvauksia ei lasketa. Ruokailuvalinta toimii sekä
ajastimen lopetuksessa että jälkikirjauksessa. Aiemmin kirjatut tauot säilyvät
ja ovat erikseen korjattavissa. Merkinnän kopiointi säilyttää ruokailuvalinnan.

Leposeuranta on erillään ylityön vapaasaldosta. Se näyttää havaitun vajauksen,
vahvistetun korvaustarpeen, pidetyn korvauksen, jäljellä olevan ajan ja määräajan.
Havainto ei vahvista poikkeuksen laillisuutta. Työaikojen tallennusta ei estetä.

- Vuorokausilepo tarkistetaan työpäivän ensimmäisen vuoron alusta 24 tunnin
  jaksossa. Jaetun päivän kirjaukset yhdistetään; pitkät yhtäjaksoiset vuorot
  tarkistetaan myös seuraavissa 24 h jaksoissa. Välttämätön toiminnan jatkuvuus
  on tässä käytetty §25:n poikkeusperuste: vähintään 5 h lepoa, enintään kolme
  peräkkäistä lyhennystä. Alle tämän jäävät havainnot pysyvät tarkistettavina.
- Korvaus ensisijaisesti seuraavassa vuorokausilevossa. Myöhempi kohdistus vaatii
  painavan työn järjestelyihin liittyvän siirtoperusteen. Ulompi seurantaraja
  on 14 kalenterivuorokautta alkuperäisestä päivästä.
- Viikkolevon 14 vrk jaksot alkavat seurannan ensimmäisen viikon maanantaista:
  pisimmät yhtenäiset lepo-osat vähintään 24 h kummassakin 7 vrk osassa ja
  yhteensä vähintään 70 h. Keskeneräistä tai alkurajalla vajaata jaksoa ei
  vahvisteta. Tarkastelu käyttää kalenterijakson sisäisiä lepo-osia; rajat
  ylittävä järjestely on tarkistettava erikseen.
- Alle 24 h jäänyt päättynyt viikko nousee tarkistettavaksi heti. Muut
  tasausvajaukset arvioidaan 14 vrk jakson päätyttyä. §28:n poikkeusperuste ja
  viikkolevon aikana tehtyä työtä vastaava korvausmäärä vahvistetaan erikseen.
  Viikkolevon korvaus annetaan säännöllistä työaikaa lyhentämällä mahdollisimman
  pian; kolmen kuukauden seurantaraja on varovaisesti kyseisen viikon alusta.
- Toteutunut lepo kohdistetaan valitsemalla oikea yhtenäinen vapaa aikaväli.
  Aikaväli ei saa sisältää työtä tai tulevaa aikaa ja sen on päätyttävä
  määräajassa. Normaali 11 h lepo varataan ennen päivittäistä korvausta;
  vähintään 35 h kohdistusjaksossa varataan ensin 35 h viikkolepoon.
  Viikkolevon korvauksessa varataan aina 35 h. Tämä kohdistusmalli on lain
  poikkeusedellytyksiä konservatiivisempi, eikä kata kaikkia mahdollisia
  työaikajärjestelyjä.
- Korvaukseen käytettyä lisäaikaa ei voi käyttää uudestaan. Vuorokausilevon
  korvausosa poistetaan myös normaalin viikkolevon tarkastelusta. Kohdistuksen
  vahvistus sisältää tiedon, ettei korvaavaa lepoa pidetty varallaoloaikana.
  Pelkkä vapaapäivä ei kuittaa vajetta. Muuttuneet työajat voivat mitätöidä
  aikaisemman kohdistuksen; tämä näkyy seurannassa, alkuperäinen säilyy historiassa.

`records[uid].rest.reviews` ja `.allocations` tallennetaan samassa työntekijän
transaktiossa. Yleinen revision tarkistus estää kilpailevan muutoksen. Historiassa
säilyvät vanhat/uudet lepojen tiedot, laskelma, tekijä, kohde ja sääntöversio.
Kohdistuksen poistaminen on korjaus, jonka alkuperäinen tieto säilyy historiassa.

Lähde: [Työaikalaki 872/2019, 3, 20–21, 24–25 ja 27–28 §](https://www.finlex.fi/fi/lainsaadanto/2019/872), tarkistettu 19.11.2026.
