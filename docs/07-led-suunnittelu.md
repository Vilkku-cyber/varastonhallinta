# LED-suunnittelu, päivitys 9.9.2026

Jatkopäivitys: erillinen paneelityyppivalinta poistettu. LED-tuote määrää paneelityypin; Pintaledin toinen palakoko valitaan automaattisesti, jos vaihtoehtoja on yksi. Prosessorilistassa näytetään vain kokonaispikselimäärälle riittävät, tunnetun kapasiteetin mallit kapasiteettijärjestyksessä. Liian pieneksi muuttuva valinta tyhjennetään. Tuntematon seinän pikselimäärä tai prosessorikapasiteetti ei tuota perusteetonta sopivuussuositusta.

Vertailulähde: vanhan varasto-projektin frontend/src/LedPlanner.jsx. Tuotetunnisteet, asennusmäärät ja prosessorien kapasiteettien varatiedot on luettu siitä; tuotetietojen MaxPixels-arvoa käytetään ensisijaisesti. Käyttäjän uudet rajaukset ohittavat vanhan koodin oletukset.

- Tavallinen LED: 500 × 500 mm. Pintaled: 1000 × 250 mm ja 500 × 250 mm, leveys ensin. Piirros käyttää todellisia palojen leveyksiä.
- Paneelivalinnat rajoittuvat LED-kategoriaan, erikseen tavallisiin ja kahteen Pintaled-kokoon. Left/right-erikoispalat on jätetty suorien palojen ulkopuolelle.
- DATA- ja VIRTA-välikaapeleita kumpaakin ceil((todelliset palat + 3) / 10) × 10. Vanhan koodin +5 ja Pintaledin puolen metrin perusruutujen laskeminen palamääräksi on korjattu.
- Tavallinen LED: data 1/rivi (vanha logiikka), virta ceil(sarakkeet/20) per rivi. Vanhan ohjelman kaksi syöttöä kaikille yli 20 palan riveille on laajennettu toimimaan myös yli 40 palan riveillä.
- Pintaled: dataketjut alhaalta ylöspäin, enintään 8 palaa = 2 m per fyysinen pystysarake. 1000 mm ja 500 mm sarakkeilla on omat ketjunsa.
- Pintaledin virtarajaa ei löytynyt vanhasta koodista. Se on syötettävä kenttään paloja / virtasyöttö; ilman rajaa virtamäärä on tuntematon ja kokonaisen kalustolistan siirto estetään. Raja tarvitsee käyttäjän vahvistuksen, eikä tavallisen LEDin rajaa oleteta sopivaksi.
- Jalkojen määräarvio: 2 tolppaa + plate per alkava metri. Lyhyt tolppa, jos yläreuna enintään 3,5 m; muuten pitkä. Perustuu vanhaan heuristiikkaan, ei kuormituslaskentaan. Tassuvalinta lisää yhden tarvikesetin. Ripustus ja seinäasennus vaativat kohdekohtaiset osat erikseen kuten vanhassa työkalussa.
- Resoluutio luetaan paneelin tuotetiedoista. Prosessorin kokonaispikselikapasiteetin ylitys estää siirron. Portti-, leveys-, korkeus- ja yhteensopivuusrajoja ei päätellä pelkästä pikselikapasiteetista.
- Kaikki kalustolistan rivit siirtyvät uudelle tai olemassa olevalle keikalle oikeilla tuotetunnisteilla. Puuttuvia nimikkeitä ei muuteta huomaamatta vapaatekstiksi. Saatavuus tarkistetaan keikan päivämäärille olemassa olevalla varauslogiikalla.

Varmistus: 27 testiä läpäisty sekä TypeScript/Vite build. Uudet testit kattavat Pintaledin geometrian, 2 m datarajan, erillisen virtarajan, 20/21/40/41 palan virtajaon, +3 kaapelipyöristyksen, LED-suodatuksen, asennusrajan ja pikselitiedot. Selaimessa tarkistettu 2500 × 500 mm Pintaled: 4 pitkää + 2 lyhyttä palaa ja 3 pystydataketjua.
