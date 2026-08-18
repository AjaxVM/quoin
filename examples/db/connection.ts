import { DatabaseSync } from 'node:sqlite'

export interface IUser {
  id: number
  name: string
  email: string
}

export interface IOrder {
  id: number
  userId: number
  item: string
  amountCents: number
}

export function createDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL
    );
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      item TEXT NOT NULL,
      amount_cents INTEGER NOT NULL
    );
  `)
  return db
}

export interface ISeedData {
  users: IUser[]
  orders: IOrder[]
}

export function seed(db: DatabaseSync, data: ISeedData): void {
  const insertUser = db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)')
  for (const user of data.users) {
    insertUser.run(user.id, user.name, user.email)
  }

  const insertOrder = db.prepare(
    'INSERT INTO orders (id, user_id, item, amount_cents) VALUES (?, ?, ?, ?)'
  )
  for (const order of data.orders) {
    insertOrder.run(order.id, order.userId, order.item, order.amountCents)
  }
}
