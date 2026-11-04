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
