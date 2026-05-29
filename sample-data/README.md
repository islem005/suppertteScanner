# Sample Product Data

Example files in multiple formats and languages for testing the import system.

## Formats

| File | Format | Separator/Dialect | Notes |
|---|---|---|---|
| `products-en.csv` | CSV | `,` (comma) | English columns: barcode, name, price, category |
| `products-fr.csv` | CSV | `;` (semicolon) | French columns: code_barre, designation, prix_vente, categorie. Uses `,` as decimal separator. |
| `products-es.csv` | CSV | `;` (semicolon) | Spanish columns: codigo, nombre, precio, categoria |
| `products-de.csv` | CSV | `;` (semicolon) | German columns: strichcode, bezeichnung, preis, kategorie. Uses `,` as decimal separator. |
| `products-ar.csv` | CSV | `,` (comma) | Arabic columns: الرمز, الاسم, السعر, الفئة |
| `products-legacy.csv` | CSV | `,` (comma) | Non-standard uppercase column names: COD_BAR, DESIGNATION, PRIX_VENTE, CAT. Tests auto-detection. |
| `products.json` | JSON | — | Array under `products` key. Standard English names. |
| `products.xlsx` | Excel | — | Sheet named "Produits". Standard English columns. 30 products. |
| `products-fr.xlsx` | Excel | — | Sheet named "Articles". French column names: code_barre, designation, prix_vente, categorie. |
| `products.db` | SQLite | — | Table `inventory` with columns: id, barcode, name, price, category. |
| `backup.db` | SQLite | — | Table `stock` with different column names: id, ean_code, product_title, selling_price, department. Tests table selection + auto-detection. |

## Languages

- **English** (`products-en.csv`, `products.xlsx`, `products.json`, `products.db`)
- **French** (`products-fr.csv`, `products-fr.xlsx`)
- **Spanish** (`products-es.csv`)
- **German** (`products-de.csv`)
- **Arabic** (`products-ar.csv`)

## Column naming conventions (for testing auto-detection)

- **Standard**: `barcode`, `name`, `price`, `category`
- **French legacy**: `COD_BAR`, `DESIGNATION`, `PRIX_VENTE`, `CAT`
- **Uppercase legacy**: `COD_BAR`, `DESIGNATION`, `PRIX_VENTE` (tests case-insensitive matching)
- **Different DB structure**: `ean_code`, `product_title`, `selling_price`, `department` (tests non-standard but recognizable names)

## Content

All files contain the same 30 products (same barcodes, names may be translated):

- 3 books (1984, To Kill a Mockingbird, The Hobbit)
- 3 Heinz condiments
- 3 bakery items
- 3 dairy products
- 3 beverages
- 3 snacks
- Plus additional items
