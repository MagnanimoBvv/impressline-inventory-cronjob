require('dotenv').config();
const axios = require('axios');
const { getLocationId, getProductByHandle, updateInventory } = require('./shopifyFunctions');

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

async function updateProducts() {
    const responseProducts = await getImpresslineProducts();
    if (responseProducts.status !== 'success') return;

    const locationId = await getLocationId();
    for (const product of responseProducts.data) {
        try {
            // if (product.clave !== 'BOL 29') continue; // If para pruebas con un producto específico
            const activeVariants = product.skus.filter((v, i, arr) => arr.findIndex(x => x.sku === v.sku) === i);

            const handle = `il-${product.clave}`.trim().toLowerCase().replace(/[\s]+/g, '-');
            const shopifyProduct = await getProductByHandle(handle);
            if (!shopifyProduct) {
                continue;
            }

            const shopifyVariants = shopifyProduct.variants.nodes;
            for (const activeVariant of activeVariants) {
                const variant = shopifyVariants.find(v => v.sku === activeVariant.sku);
                const variantInventory = activeVariant.stock;
                console.log(`Variante encontrada: ${shopifyProduct.title} ${variant.title}, Inventario: Prev ${variant.inventoryQuantity} Now ${variantInventory}`);

                if (variant.inventoryQuantity !== variantInventory) {
                    const variantToUpdate = {
                        quantities: {
                            changeFromQuantity: null,
                            inventoryItemId: variant.inventoryItem.id,
                            locationId,
                            quantity: variantInventory,
                        },
                        name: "available",
                        reason: "correction",
                    };
                    const response = await updateInventory(variantToUpdate);
                    console.log('Inventario actualizado:', response.changes);
                }
            }
            // break;
        } catch (error) {
            console.error(`Error actualizando el producto ${product.nombre} ${product.clave}:`, error);
        }
    }
}

updateProducts();