require('dotenv').config();
const axios = require('axios');
const { getLocationId, paginateProductsByVendor, updateInventory } = require('./shopifyFunctions');

async function getImpresslineProducts() {
    const response = await axios.get(
        'https://www.impressline.com.mx/api/v1/productos',
        {
            headers: {
                'Authorization': `Bearer ${process.env.ILN_AUTH_TOKEN}`
            }
        }
    );

    return response.data;
}

function getStores() {
    const storeNames = process.env.STORES.split(',');

    return storeNames.map(name => ({
        name,
        graphqlUrl: process.env[`GRAPHQL_URL_${name}`],
        shopifyToken: process.env[`SHOPIFY_TOKEN_${name}`],
    }));
}

async function updateProducts(store, products) {
    const locationId = await getLocationId(store);
    const shopifyProducts = await paginateProductsByVendor(store, 'Impressline');
    for (const product of products.data) {
        try {
            // if (product.clave !== 'BOL 29') continue; // If para pruebas con un producto específico
            const handle = `il-${product.clave}`.trim().toLowerCase().replace(/[\s]+/g, '-');
            const shopifyProduct = shopifyProducts.find(p => p.handle === handle);
            if (!shopifyProduct) continue;

            const shopifyVariants = shopifyProduct.variants.nodes;
            const activeVariants = product.skus.filter((v, i, arr) => arr.findIndex(x => x.sku === v.sku) === i);
            const activeVariantBySKU = new Map(activeVariants.map(v => [v.sku, v]));

            for (const variant of shopifyVariants) {
                const activeVariant = activeVariantBySKU.get(variant.sku);
                const targetInventory = activeVariant ? activeVariant.stock : 0;
                const label = activeVariant ? 'Variante existente' : 'Variante faltante';
                console.log(`[${store.name}] ${label}: ${shopifyProduct.title} ${variant.title}, Prev ${variant.inventoryQuantity} Now ${targetInventory}`);

                if (variant.inventoryQuantity === targetInventory) continue;

                const variantToUpdate = {
                    quantities: {
                        changeFromQuantity: null,
                        inventoryItemId: variant.inventoryItem.id,
                        locationId,
                        quantity: targetInventory,
                    },
                    name: "available",
                    reason: "correction",
                };
                const response = await updateInventory(store,variantToUpdate);
                console.log(`[${store.name}] Inventario actualizado:`, response.changes);
            }
            // break;
        } catch (error) {
            console.error(`[${store.name}] Error actualizando ${product.nombre} ${product.clave}:`, error);
        }
    }
}

async function main() {
    const products = await getImpresslineProducts();
    if (products.status !== 'success') return;

    const stores = getStores();
    for (const store of stores) {
        await updateProducts(store, products);
    }
}

main();
