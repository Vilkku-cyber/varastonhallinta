// Backend: Node.js + Express
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Käytetään tiedostopohjaista SQLite-tietokantaa
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY, name TEXT, quantity INTEGER, status TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS trips (id INTEGER PRIMARY KEY, name TEXT, date TEXT, status TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS trip_items (id INTEGER PRIMARY KEY, trip_id INTEGER, inventory_id INTEGER, quantity INTEGER, FOREIGN KEY(trip_id) REFERENCES trips(id), FOREIGN KEY(inventory_id) REFERENCES inventory(id))");
    db.run("CREATE TABLE IF NOT EXISTS product_details (id INTEGER PRIMARY KEY, product_id INTEGER, dimensions TEXT, weight TEXT, details TEXT, FOREIGN KEY(product_id) REFERENCES inventory(id))");
});

// Hae varaston tilanne
app.get('/api/inventory', (req, res) => {
    db.all(`
        SELECT inventory.id, inventory.name, 
               inventory.quantity AS available, 
               COALESCE(SUM(trip_items.quantity), 0) AS reserved
        FROM inventory
        LEFT JOIN trip_items ON inventory.id = trip_items.inventory_id
        GROUP BY inventory.id
    `, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Lisää uusi tuote varastoon
app.post('/api/inventory/add', (req, res) => {
    const { name, quantity, status, dimensions, weight, details } = req.body;

    if (!name || !quantity || !status) {
        return res.status(400).json({ error: "Pakolliset kentät puuttuvat" });
    }

    db.run("INSERT INTO inventory (name, quantity, status) VALUES (?, ?, ?)", 
    [name, quantity, status], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const productId = this.lastID; 

        db.run("INSERT INTO product_details (product_id, dimensions, weight, details) VALUES (?, ?, ?, ?)", 
        [productId, dimensions, weight, details], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: productId, message: "Tuote lisätty onnistuneesti!" });
        });
    });
});


//hae tueten tiedot
app.get('/api/product/:id', (req, res) => {
    const productId = req.params.id;
    db.get(`
        SELECT inventory.id, inventory.name, 
               (inventory.quantity - COALESCE(SUM(trip_items.quantity), 0)) AS available, 
               COALESCE(SUM(trip_items.quantity), 0) AS reserved,
               product_details.dimensions, 
               product_details.weight, 
               product_details.details
        FROM inventory
        LEFT JOIN trip_items ON inventory.id = trip_items.inventory_id
        LEFT JOIN product_details ON inventory.id = product_details.product_id
        WHERE inventory.id = ?
        GROUP BY inventory.id
    `, [productId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: "Tuotetta ei löydy." });
            return;
        }
        res.json(row);
    });
});

// Poista tuote ja sen tiedot
app.delete('/api/product/:id', (req, res) => {
    const productId = req.params.id;

    // Poista ensin tuotteen tiedot product_details-taulusta
    db.run("DELETE FROM product_details WHERE product_id = ?", [productId], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Poista sitten itse tuote inventory-taulusta
        db.run("DELETE FROM inventory WHERE id = ?", [productId], (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            res.json({ message: "Tuote poistettu onnistuneesti!" });
        });
    });
});


// Hae aktiiviset keikat
app.get('/api/trips', (req, res) => {
    db.all(`
        SELECT trips.id, trips.name, trips.date, trips.status, 
               inventory.name AS item_name, trip_items.quantity
        FROM trips
        LEFT JOIN trip_items ON trips.id = trip_items.trip_id
        LEFT JOIN inventory ON trip_items.inventory_id = inventory.id
    `, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const trips = {};
        rows.forEach(row => {
            if (!trips[row.id]) {
                trips[row.id] = { id: row.id, name: row.name, date: row.date, status: row.status, items: [] };
            }
            if (row.item_name) {
                trips[row.id].items.push({ name: row.item_name, quantity: row.quantity });
            }
        });

        res.json(Object.values(trips));
    });
});

// Hae yksittäinen keikka
app.get('/api/trip/:id', (req, res) => {
    const tripId = req.params.id;
    db.all(`
        SELECT trips.id, trips.name, trips.date, trips.status, 
               inventory.id AS inventory_id, inventory.name AS item_name, trip_items.quantity
        FROM trips
        LEFT JOIN trip_items ON trips.id = trip_items.trip_id
        LEFT JOIN inventory ON trip_items.inventory_id = inventory.id
        WHERE trips.id = ?
    `, [tripId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (rows.length === 0) {
            res.status(404).json({ message: "Keikkaa ei löydy" });
            return;
        }

        const trip = {
            id: rows[0].id,
            name: rows[0].name,
            date: rows[0].date,
            status: rows[0].status,
            items: rows.filter(row => row.inventory_id !== null).map(row => ({
                id: row.inventory_id,
                name: row.item_name,
                quantity: row.quantity
            }))
        };

        res.json(trip);
    });
});


// Lisää uusi keikka
app.post('/api/trips', (req, res) => {
    const { name, date, items } = req.body;

    db.run("INSERT INTO trips (name, date, status) VALUES (?, ?, 'planned')", [name, date], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const tripId = this.lastID;

        if (items && items.length > 0) {
            const stmt = db.prepare("INSERT INTO trip_items (trip_id, inventory_id, quantity) VALUES (?, ?, ?)");
            items.forEach(item => {
                stmt.run(tripId, item.id, item.quantity);
                db.run("UPDATE inventory SET quantity = quantity - ? WHERE id = ?", [item.quantity, item.id]);
            });
            stmt.finalize();
        }

        res.json({ id: tripId, message: "Keikka lisätty onnistuneesti" });
    });
});

// Päivitä keikan tiedot
app.post('/api/trip/update', (req, res) => {
    const { id, name, date, items } = req.body;

    db.all("SELECT inventory_id, quantity FROM trip_items WHERE trip_id = ?", [id], (err, oldItems) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        oldItems.forEach(oldItem => {
            db.run("UPDATE inventory SET quantity = quantity + ? WHERE id = ?", [oldItem.quantity, oldItem.inventory_id]);
        });

        db.run("UPDATE trips SET name = ?, date = ? WHERE id = ?", [name, date, id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            db.run("DELETE FROM trip_items WHERE trip_id = ?", [id], function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                if (items && items.length > 0) {
                    const stmt = db.prepare("INSERT INTO trip_items (trip_id, inventory_id, quantity) VALUES (?, ?, ?)");
                    items.forEach(item => {
                        stmt.run(id, item.id, item.quantity);
                        db.run("UPDATE inventory SET quantity = quantity - ? WHERE id = ?", [item.quantity, item.id]);
                    });
                    stmt.finalize();
                }

                res.json({ message: "Keikka päivitetty onnistuneesti" });
            });
        });
    });
});

// **KEIKAN POISTAMINEN (KORJATTU)**
app.delete('/api/trip/:id', (req, res) => {
    const tripId = req.params.id;

    // Tarkistetaan, onko keikka olemassa
    db.get("SELECT id FROM trips WHERE id = ?", [tripId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: "Keikkaa ei löydy." });
            return;
        }

        // Palautetaan tuotteet varastoon ennen poistoa
        db.all("SELECT inventory_id, quantity FROM trip_items WHERE trip_id = ?", [tripId], (err, items) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            items.forEach(item => {
                db.run("UPDATE inventory SET quantity = quantity + ? WHERE id = ?", [item.quantity, item.inventory_id]);
            });

            // Poistetaan ensin trip_items-taulusta
            db.run("DELETE FROM trip_items WHERE trip_id = ?", [tripId], (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                // Poistetaan itse keikka
                db.run("DELETE FROM trips WHERE id = ?", [tripId], (err) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ message: "Keikka poistettu onnistuneesti!" });
                });
            });
        });
    });
});

// Merkitse keikka palautetuksi ja nollaa keikalla olevat tuotteet
app.post('/api/trip/return/:id', (req, res) => {
    const tripId = req.params.id;

    // Hae keikan tuotteet
    db.all("SELECT inventory_id, quantity FROM trip_items WHERE trip_id = ?", [tripId], (err, items) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Palautetaan tuotteet varastoon
        items.forEach(item => {
            db.run("UPDATE inventory SET quantity = quantity + ? WHERE id = ?", [item.quantity, item.inventory_id]);
        });

        // Päivitetään keikan status
        db.run("UPDATE trips SET status = 'returned' WHERE id = ?", [tripId], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            res.json({ message: "Keikka palautettu ja tuotteet palautettu varastoon!" });
        });
    });
});

// Käynnistä serveri
const PORT = 5000;
const HOST = '0.0.0.0'; // 🔥 Tämä sallii yhteydet kaikilta IP-osoitteilta (mukaan lukien Tailscale)

app.listen(5000, '0.0.0.0', () => {
    console.log('Server running on port 5000');
});
