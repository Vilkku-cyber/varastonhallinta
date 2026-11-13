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

Lomakkeessa on aloitus, lopetus, muistiinpano ja kopiointi. Tauot oletetaan
pidetyiksi; uusia automaattisia minuuttivähennyksiä ei tehdä. Kirjauksettomat
päivät tulkitaan vapaapäiviksi. Vanhat taukotiedot ja laskentatilannekuvat säilyvät.
Kuvassa ollut johdantolaatikko on poistettu. Laskentaperusteet ja pykälälinkit
ovat edelleen tulosten sekä historian yhteydessä.

Laskentaprofiili on yleistyöaika 8 h / 40 h, Helsinki, viikko ma–su. TES,
poikkeussopimukset, juhlapäivien erilliskorotukset ja neljän kuukauden keskiarvon
varmistus ovat erillisiä tarkistuksia. Laskennallinen korvausvapaa ei ole
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
perusosa on jo lisäajassa. Sunnuntaikorotus ei sisälly vapaasaldoon. Lyhyemmän
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

Sääntöversio on `fi-general-2026-11-13-v4`. Vanhoja merkintöjä, aikaleimoja tai
historian laskentatilannekuvia ei muuteta. Varmuuskopiointi sisältää myös asetukset.
