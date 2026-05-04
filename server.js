const express = require('express');
const path = require('path');
const { Pool, types } = require('pg');
types.setTypeParser(1700, 'text', parseFloat);
const app = express();
const PORT = 3000;
const pool = new Pool({ host: '/var/run/postgresql', database: 'steeltrack', user: 'postgres', port: 5432 });
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.get('/api/data', async (req, res) => {
    try {
        const m = await pool.query('SELECT * FROM materials');
        const t = await pool.query('SELECT * FROM transactions');
        const p = await pool.query('SELECT * FROM projects');
        const s = await pool.query('SELECT * FROM suppliers');
        const u = await pool.query('SELECT * FROM users_table');
        const l = await pool.query('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 200');
        const c = await pool.query('SELECT name FROM categories ORDER BY name');
        const un = await pool.query('SELECT name FROM units ORDER BY name');
        res.json({ success: true, data: { materials: m.rows, transactions: t.rows, projects: p.rows, suppliers: s.rows, users: u.rows, logs: l.rows, categories: c.rows.map(r=>r.name), units: un.rows.map(r=>r.name) }});
    } catch (err) { res.json({ success: false }); }
});
app.post('/api/materials', async (req, res) => { const m=req.body; await pool.query('INSERT INTO materials VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET name=$2,cat=$3,unit=$4,qty=$5,cost=$6,low=$7,note=$8',[m.id,m.name,m.cat,m.unit,m.qty,m.cost,m.low,m.note||'']); res.json({success:true}); });
app.post('/api/transactions', async (req, res) => { const t=req.body; await pool.query('INSERT INTO transactions VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO UPDATE SET qty=$8',[t.id,t.mid,t.supplierId||'',t.projectId||'',t.date,t.datetime,t.type,t.qty,t.unitPrice,t.vatRate,t.subtotal,t.vatAmount,t.totalAmount,t.note,t.attachment,t.invoiceImage]); if(t.type==='purchase') await pool.query('UPDATE materials SET qty = COALESCE(qty,0) + CAST($1 AS BIGINT) WHERE id=$2',[t.qty,t.mid]); else if(t.type==='usage') await pool.query('UPDATE materials SET qty = COALESCE(qty,0) - CAST($1 AS BIGINT) WHERE id=$2',[t.qty,t.mid]); else if(t.type==='return') await pool.query('UPDATE materials SET qty = COALESCE(qty,0) + CAST($1 AS BIGINT) WHERE id=$2',[t.qty,t.mid]); res.json({success:true}); });
app.post('/api/projects', async (req, res) => { const p=req.body; await pool.query('INSERT INTO projects VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET name=$2,budget=$3,spent=$4',[p.id,p.name,p.budget,p.spent]); res.json({success:true}); });
app.post('/api/suppliers', async (req, res) => { const s=req.body; await pool.query('INSERT INTO suppliers VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET name=$2,phone=$3,email=$4,address=$5',[s.id,s.name,s.phone,s.email,s.address]); res.json({success:true}); });
app.post('/api/users-table', async (req, res) => { const u=req.body; await pool.query('INSERT INTO users_table VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=$2,username=$3,password=$4,role=$5,permissions=$6',[u.id,u.name,u.username,u.password,u.role,u.permissions]); res.json({success:true}); });
app.post('/api/categories', async (req, res) => { await pool.query('DELETE FROM categories'); for(const c of (req.body.categories||[])){await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING',[c]);} res.json({success:true}); });
app.post('/api/units', async (req, res) => { await pool.query('DELETE FROM units'); for(const u of (req.body.units||[])){await pool.query('INSERT INTO units (name) VALUES ($1) ON CONFLICT DO NOTHING',[u]);} res.json({success:true}); });
app.post('/api/logs', async (req, res) => { const l=req.body; await pool.query('INSERT INTO logs (id,user_id,user_name,action,details) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET user_id=$2,user_name=$3,action=$4,details=$5',[l.id,l.userId,l.userName,l.action,l.details]); res.json({success:true}); });
app.listen(PORT, '0.0.0.0', () => console.log('OK'));

app.delete('/api/projects/:id', async (req, res) => { await pool.query('DELETE FROM projects WHERE id=$1',[req.params.id]); res.json({success:true}); });
app.delete('/api/suppliers/:id', async (req, res) => { await pool.query('DELETE FROM suppliers WHERE id=$1',[req.params.id]); res.json({success:true}); });
app.delete('/api/materials/:id', async (req, res) => { await pool.query('DELETE FROM materials WHERE id=$1',[req.params.id]); res.json({success:true}); });
