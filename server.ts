import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

app.use(cors());
app.use(express.json());

// MongoDB Connection
const getMongoUri = () => {
  const envUri = (process.env.MONGO_URI || '').trim().replace(/^["']|["']$/g, '');

  if (!envUri) {
    throw new Error('Missing MONGO_URI. Set it in your .env file.');
  }

  if (envUri.startsWith('mongodb://') || envUri.startsWith('mongodb+srv://')) {
    return envUri;
  }

  throw new Error('Invalid MONGO_URI. It must start with mongodb:// or mongodb+srv://');
};

let MONGO_URI = '';
try {
  MONGO_URI = getMongoUri();
} catch (err: any) {
  console.error(err?.message || 'Invalid MongoDB configuration.');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// --- Schemas ---

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'admin', 'manager', 'user', 'terminal'], default: 'user' },
  outletId: { type: String },
  displayName: { type: String }
});

const outletSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  managerId: { type: String },
  licenseNumber: { type: String },
  licenseValidUntil: { type: Date }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  unitPrice: { type: Number, required: true },
  description: { type: String }
});

const inventorySchema = new mongoose.Schema({
  productId: { type: String, required: true },
  outletId: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

const saleSchema = new mongoose.Schema({
  outletId: { type: String, required: true },
  userId: { type: String, required: true },
  items: [{
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const transferSchema = new mongoose.Schema({
  fromOutletId: { type: String, required: true },
  toOutletId: { type: String, required: true },
  productId: { type: String, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Outlet = mongoose.model('Outlet', outletSchema);
const Product = mongoose.model('Product', productSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);
const Sale = mongoose.model('Sale', saleSchema);
const Transfer = mongoose.model('Transfer', transferSchema);

// --- Middleware ---

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const isSuperAdminEmail = email === "chungledurgeshchungle@gmail.com";
    
    const user = new User({
      email,
      password: hashedPassword,
      displayName: displayName || email.split('@')[0],
      role: isSuperAdminEmail ? 'super_admin' : 'user'
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET);
    res.json({ token, user: { id: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId } });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user._id, email: user.email, role: user.role, displayName: user.displayName, outletId: user.outletId });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// --- API Routes ---

// Users
app.get('/api/users', authenticateToken, async (req, res) => {
  const users = await User.find({}, '-password');
  res.json(users.map(u => ({ uid: u._id, email: u.email, role: u.role, displayName: u.displayName, outletId: u.outletId })));
});

app.post('/api/users', authenticateToken, async (req: any, res) => {
  try {
    const { email, password, role, displayName, outletId } = req.body;
    const creatorRole = req.user.role;

    // Hierarchical validation
    if (creatorRole === 'super_admin') {
      // Super admin can create any role
    } else if (creatorRole === 'admin') {
      // Admin can only create manager, user, terminal
      if (['super_admin', 'admin'].includes(role)) {
        return res.status(403).json({ message: 'Admins cannot create super admins or other admins' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized to create users' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      role,
      displayName: displayName || email.split('@')[0],
      outletId
    });

    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error creating user' });
  }
});

app.patch('/api/users/:id', authenticateToken, async (req: any, res) => {
  try {
    const creatorRole = req.user.role;
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const newRole = req.body.role;

    // Hierarchical validation for updates
    if (creatorRole === 'super_admin') {
      // Super admin can update anyone
    } else if (creatorRole === 'admin') {
      // Admin cannot update super admins or other admins
      if (['super_admin', 'admin'].includes(targetUser.role)) {
        return res.status(403).json({ message: 'Admins cannot modify super admins or other admins' });
      }
      // Admin cannot promote someone to super_admin or admin
      if (newRole && ['super_admin', 'admin'].includes(newRole)) {
        return res.status(403).json({ message: 'Admins cannot promote users to admin or super admin' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized to update users' });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Outlets
app.get('/api/outlets', authenticateToken, async (req, res) => {
  try {
    const outlets = await Outlet.find();
    res.json(outlets.map(o => ({
      id: o._id,
      name: o.name,
      location: o.location,
      managerId: o.managerId,
      licenseNumber: (o as any).licenseNumber,
      licenseValidUntil: (o as any).licenseValidUntil
    })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/outlets', authenticateToken, async (req, res) => {
  try {
    const outlet = new Outlet(req.body);
    await outlet.save();
    res.status(201).json({
      id: outlet._id,
      name: outlet.name,
      location: outlet.location,
      managerId: outlet.managerId,
      licenseNumber: (outlet as any).licenseNumber,
      licenseValidUntil: (outlet as any).licenseValidUntil
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch('/api/outlets/:id', authenticateToken, async (req, res) => {
  try {
    const outlet = await Outlet.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!outlet) return res.status(404).json({ message: 'Outlet not found' });
    res.json({
      id: outlet._id,
      name: outlet.name,
      location: outlet.location,
      managerId: outlet.managerId,
      licenseNumber: (outlet as any).licenseNumber,
      licenseValidUntil: (outlet as any).licenseValidUntil
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/outlets/:id', authenticateToken, async (req, res) => {
  try {
    await Outlet.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Products
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products.map(p => ({ id: p._id, name: p.name, category: p.category, sku: p.sku, unitPrice: p.unitPrice, description: p.description })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ id: product._id, name: product.name, category: product.category, sku: product.sku, unitPrice: product.unitPrice, description: product.description });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ id: product._id, name: product.name, category: product.category, sku: product.sku, unitPrice: product.unitPrice, description: product.description });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Inventory
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { outletId } = req.query;
    const filter = outletId ? { outletId } : {};
    const inventory = await Inventory.find(filter);
    res.json(inventory.map(i => ({ id: i._id, productId: i.productId, outletId: i.outletId, quantity: i.quantity, lastUpdated: i.lastUpdated })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { productId, outletId, quantity } = req.body;
    let item = await Inventory.findOne({ productId, outletId });
    if (item) {
      item.quantity = quantity;
      item.lastUpdated = new Date();
    } else {
      item = new Inventory(req.body);
    }
    await item.save();
    res.status(201).json({ id: item._id, productId: item.productId, outletId: item.outletId, quantity: item.quantity, lastUpdated: item.lastUpdated });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Sales
app.get('/api/sales', authenticateToken, async (req, res) => {
  try {
    const { outletId } = req.query;
    const filter = outletId ? { outletId } : {};
    const sales = await Sale.find(filter).sort({ timestamp: -1 });
    res.json(sales.map(s => ({ id: s._id, outletId: s.outletId, userId: s.userId, items: s.items, totalAmount: s.totalAmount, timestamp: s.timestamp })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/sales', authenticateToken, async (req: any, res: any) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const saleOutletId = req.body?.outletId;
    if (!saleOutletId) {
      throw new Error('outletId is required');
    }

    // Enforce outlet assignment for non-admin users
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      const actingUser = await User.findById(req.user.id).select('outletId').session(session);
      if (!actingUser?.outletId) {
        return res.status(403).json({ message: 'User is not assigned to an outlet' });
      }
      if (actingUser.outletId !== saleOutletId) {
        return res.status(403).json({ message: 'Unauthorized outlet for this sale' });
      }
    }

    // Block sales for expired licenses (user/manager/terminal)
    const outlet = await Outlet.findById(saleOutletId).select('licenseValidUntil').session(session);
    const licenseValidUntil = (outlet as any)?.licenseValidUntil as Date | undefined;
    if (
      licenseValidUntil &&
      licenseValidUntil.getTime() < Date.now() &&
      ['manager', 'user', 'terminal'].includes(req.user.role)
    ) {
      return res.status(403).json({ message: 'Outlet license expired. Sales are disabled for this outlet.' });
    }

    const sale = new Sale(req.body);
    await sale.save({ session });

    // Update inventory
    for (const item of sale.items) {
      const inv = await Inventory.findOne({ productId: item.productId, outletId: sale.outletId }).session(session);
      if (!inv || inv.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
      inv.quantity -= item.quantity;
      inv.lastUpdated = new Date();
      await inv.save({ session });
    }

    await session.commitTransaction();
    res.status(201).json({ id: sale._id, outletId: sale.outletId, userId: sale.userId, items: sale.items, totalAmount: sale.totalAmount, timestamp: sale.timestamp });
  } catch (err: any) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

// Transfers
app.get('/api/transfers', authenticateToken, async (req, res) => {
  try {
    const transfers = await Transfer.find().sort({ timestamp: -1 });
    res.json(transfers.map(t => ({ id: t._id, fromOutletId: t.fromOutletId, toOutletId: t.toOutletId, productId: t.productId, quantity: t.quantity, status: t.status, timestamp: t.timestamp })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/transfers', authenticateToken, async (req, res) => {
  try {
    const transfer = new Transfer(req.body);
    await transfer.save();
    res.status(201).json({ id: transfer._id, fromOutletId: transfer.fromOutletId, toOutletId: transfer.toOutletId, productId: transfer.productId, quantity: transfer.quantity, status: transfer.status, timestamp: transfer.timestamp });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.patch('/api/transfers/:id', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transfer = await Transfer.findById(req.params.id).session(session);
    if (!transfer) throw new Error('Transfer not found');

    const oldStatus = transfer.status;
    const newStatus = req.body.status;

    if (oldStatus === 'pending' && newStatus === 'completed') {
      // Deduct from source
      const fromInv = await Inventory.findOne({ productId: transfer.productId, outletId: transfer.fromOutletId }).session(session);
      if (!fromInv || fromInv.quantity < transfer.quantity) {
        throw new Error('Insufficient stock at source outlet');
      }
      fromInv.quantity -= transfer.quantity;
      await fromInv.save({ session });

      // Add to destination
      let toInv = await Inventory.findOne({ productId: transfer.productId, outletId: transfer.toOutletId }).session(session);
      if (!toInv) {
        toInv = new Inventory({ productId: transfer.productId, outletId: transfer.toOutletId, quantity: 0 });
      }
      toInv.quantity += transfer.quantity;
      await toInv.save({ session });
    }

    transfer.status = newStatus;
    await transfer.save({ session });

    await session.commitTransaction();
    res.json({ id: transfer._id, fromOutletId: transfer.fromOutletId, toOutletId: transfer.toOutletId, productId: transfer.productId, quantity: transfer.quantity, status: transfer.status, timestamp: transfer.timestamp });
  } catch (err: any) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

// --- Vite Integration ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
