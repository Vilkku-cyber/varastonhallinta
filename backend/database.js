const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    // Luodaan varasto-taulu
    db.run(`CREATE TABLE inventory (
        id INTEGER PRIMARY KEY,
        name TEXT,
        quantity INTEGER,
        status TEXT
    )`);

    // Luodaan keikat-taulu
    db.run(`CREATE TABLE trips (
        id INTEGER PRIMARY KEY,
        name TEXT,
        status TEXT
    )`);

    // Luodaan keikan tavarat-taulu (yhdistää varastotuotteet keikkoihin)
    db.run(`CREATE TABLE trip_items (
        id INTEGER PRIMARY KEY,
        trip_id INTEGER,
        inventory_id INTEGER,
        quantity INTEGER,
        FOREIGN KEY(trip_id) REFERENCES trips(id),
        FOREIGN KEY(inventory_id) REFERENCES inventory(id)
    )`);

    // Esimerkkidata
    db.run("INSERT INTO inventory (name, quantity, status) VALUES ('40\" TV', 34, 'available')");
    db.run("INSERT INTO inventory (name, quantity, status) VALUES ('75\" TV', 27, 'available')");
    db.run("INSERT INTO trips (name, status) VALUES ('JUNSKI', 'ongoing')");
    db.run("INSERT INTO trip_items (trip_id, inventory_id, quantity) VALUES (1, 1, 2)");
    db.run("INSERT INTO trip_items (trip_id, inventory_id, quantity) VALUES (1, 2, 2)");
});

module.exports = db;


db.serialize(() => {
    // Luodaan varasto-taulu (jos ei ole jo olemassa)
    db.run(`CREATE TABLE inventory (
        id INTEGER PRIMARY KEY,
        name TEXT,
        quantity INTEGER,
        status TEXT
    )`);

    // Luodaan keikat-taulu (jos ei ole jo olemassa)
    db.run(`CREATE TABLE trips (
        id INTEGER PRIMARY KEY,
        name TEXT,
        date TEXT
    )`);

    // Luodaan keikan tavarat-taulu (yhdistää varastotuotteet keikkoihin)
    db.run(`CREATE TABLE trip_items (
        id INTEGER PRIMARY KEY,
        trip_id INTEGER,
        inventory_id INTEGER,
        quantity INTEGER,
        FOREIGN KEY(trip_id) REFERENCES trips(id),
        FOREIGN KEY(inventory_id) REFERENCES inventory(id)
    )`);

    // Lisää varastoon testituotteita
    db.run("INSERT INTO inventory (name, quantity, status) VALUES ('40\" TV', 10, 'available')");
    db.run("INSERT INTO inventory (name, quantity, status) VALUES ('55\" TV', 8, 'available')");
    db.run("INSERT INTO inventory (name, quantity, status) VALUES ('75\" TV', 5, 'available')");
});
