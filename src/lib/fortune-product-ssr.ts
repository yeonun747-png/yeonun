import type { Product } from "@/lib/data/content";

/** SSR/RSC props — interpretation_prompt는 수 KB~수십 KB라 Vercel 렌더 한도를 넘길 수 있음 */
export function stripFortuneProductForSsrProps(product: Product): Product {
  const menus = product.fortune_menu?.main_menus;
  if (!menus?.length) return product;
  return {
    ...product,
    fortune_menu: {
      main_menus: menus.map((main) => ({
        ...main,
        sub_menus: main.sub_menus.map((sub) => ({
          ...sub,
          interpretation_prompt: "",
        })),
      })),
    },
  };
}
