# Calendario de MT y MO · Teselia N2/B2

Aprobado por Jose el 13/11/2026, con los casos a revisar del final tal como están. Reglas (PRD §0, 13/11/2026): las mismas que en Hoenn. Cada MT/MO cuenta desde el tramo en que se llega a su zona; un premio de líder, desde el tramo siguiente; las de tienda cuentan (en la campaña no hay dinero); se puede volver a zonas anteriores al abrir una MO. Fuera: las MT de la PWT, los tutores y lo de después de la Liga.

Fuentes: la lista y la ubicación de cada MT/MO son de Serebii (`tmhm.shtml`); el tramo de cada zona, de la guía de N2/B2 de WikiDex, que está dividida por medallas. La correspondencia zona → tramo es la tabla `ZONES` de `scripts/build-n2b2-calendar.mjs` (`npm run gen:n2b2-calendar`), que falla ante una zona nueva. El [calendario ejecutable](../../data/nuzlocke/unova-n2b2-calendar.json) tiene 64 entradas.

## Novedades antes de cada combate

| Antes de | Nivel | Nuevas MT | MO recibidas |
|---|---:|---|---|
| Cheren | 13 | MT21 Frustración, MT27 Retribución | — |
| Hiedra | 18 | MT46 Ladrón, MT83 Avivar, MT94 Golpe Roca | — |
| Camus | 24 | MT09 Carga Tóxica, MT41 Tormento, MT44 Descanso, MT45 Atracción, MT70 Destello | MO01 Corte, MO04 Fuerza |
| Camila | 30 | MT16 Pantalla de Luz, MT28 Excavar, MT33 Reflejo, MT39 Tumba Rocas, MT49 Eco Voz, MT66 Vendetta, MT73 Onda Trueno, MT74 Giro Bola, MT76 Estoicismo, MT95 Alarido | — |
| Yakón | 33 | MT63 Embargo, MT72 Voltiocambio | MO02 Vuelo |
| Gerania | 39 | MT07 Granizo, MT11 Día Soleado, MT18 Danza Lluvia, MT37 Tormenta de Arena, MT40 Golpe Aéreo, MT53 Energibola, MT56 Lanzamiento, MT58 Caída Libre, MT78 Terratemblor, MT80 Avalancha | MO03 Surf |
| Lirio | 48 | MT14 Ventisca, MT15 Hiperrayo, MT25 Trueno, MT29 Psíquico, MT30 Bola Sombra, MT38 Llamarada, MT57 Rayo Carga, MT61 Fuego Fatuo, MT62 Acróbata, MT65 Garra Umbría, MT68 Gigaimpacto, MT69 Pulimento, MT81 Tijera X | MO06 Buceo |
| Ciprián | 51 | MT42 Fachada, MT82 Cola Dragón | — |
| Anís | 58 | MT01 Afilagarras, MT03 Psicocarga, MT05 Rugido, MT06 Tóxico, MT12 Mofa, MT13 Rayo Hielo, MT24 Rayo, MT35 Lanzallamas, MT55 Escaldar, MT67 Represalia, MT93 Voltio Cruel | MO05 Cascada |
| Aza | 58 | — | — |
| Catleya | 58 | — | — |
| Lotto | 58 | — | — |
| Iris | 59 | — | — |

## Fuera del calendario

- **PWT (canje de PB):** MT10 Poder Oculto, MT17 Protección, MT20 Velo Sagrado, MT23 Antiaéreo, MT31 Demolición, MT32 Doble Equipo, MT34 Onda Tóxica, MT48 Canon, MT51 Cambio de Banda, MT59 Calcinación, MT60 Último Lugar, MT64 Explosión, MT75 Danza Espada, MT77 Autosugestión, MT79 Vaho Gélido, MT87 Fanfarronear, MT88 Picoteo, MT89 Ida y Vuelta.
- **Después de la Liga:** MT02 Garra Dragón, MT04 Paz Mental, MT08 Corpulencia, MT19 Telequinesis, MT22 Rayo Solar, MT26 Terremoto, MT36 Bomba Lodo, MT43 Nitrocarga, MT47 Puntapié, MT50 Sofoco, MT52 Onda Certera, MT71 Roca Afilada, MT84 Puya Nociva, MT85 Comesueños, MT86 Hierba Lazo, MT90 Sustituto, MT91 Cañón Resplandor, MT92 Espacio Raro.
- **Con condición aparte:** MT54 Falso Tortazo (el científico de la Montaña Reversia la da si se han visto todos los Pokémon de la cueva; en la campaña no hay Pokémon salvajes).

## Casos a revisar

- **MT53 Energibola** (Pueblo Engobe): Serebii no dice cómo se coge; en la ciudad se usa Surf, así que cuenta desde que se tiene Surf (tramo de Gerania).
- **MT67 Represalia** (Fragata Plasma): la fragata se visita antes de Gerania y antes de la Liga; sin saber en qué visita está, se pone la última (tramo de la Liga).
- **Montaña Reversia** cambia entre Negro 2 y Blanco 2; las MT30 y MT69 se dan por accesibles en las dos.


# Objetos y canje · Teselia N2/B2

Aprobado por Jose el 13/11/2026, con la propuesta de PB y los casos a revisar del final tal como están. Reglas (PRD §0, 13/11/2026), las de Hoenn: una unidad por fuente en los equipables; bayas y objetos de tienda (con dinero), sin límite; los objetos de evolución, **una unidad por tipo en toda la campaña** (se gasta al usarla). Cuentan los objetos ocultos (Zahorí) y los de una sola versión (Negro 2 y Blanco 2 a la vez). Fuera: lo de después de la Liga, lo aleatorio (nubes de polvo), lo semanal o de temporada, lo que pide una condición aparte (enseñar Pokémon, minijuegos, capturar legendarios) y las tiendas de PB (Estación de Metro y PWT), que van al canje.

Fuentes: objetos y zonas de Serebii (`items.shtml`), tramo de cada zona según la guía de WikiDex. Generador: `scripts/build-n2b2-items.mjs` (`npm run gen:n2b2-items`), que falla ante una zona o condición nueva. [Fichero](../../data/nuzlocke/unova-n2b2-items.json): 72 equipables y bayas, 14 objetos de evolución, 125 fuera.

## Novedades antes de cada combate

| Antes de | Objetos de evolución | Equipables (una unidad por fuente salvo indicación) | Bayas (sin límite) |
|---|---|---|---|
| Cheren | Piedra Agua | Cinta Experto ×2, Toxiestrella | Baya Aranja, Baya Meloc |
| Hiedra | — | Pañuelo de Seda | — |
| Camus | — | Agua Mística ×2, Carbón ×2, Casco Dentado, Cuchara Torcida, Gafas de Sol, Garra Rápida, Gema Roca, Gema Veneno, Lazo Destino, Lodo Negro, Mineral Evolutivo, Periscopio, Piedra Dura, Restos, Semilla Milagro ×2 | Baya Atania, Baya Perasi, Baya Safre, Baya Zreza |
| Camila | Piedra Fuego, Piedra Hoja, Piedra Solar, Piedra Trueno | Arena Fina, Brazal Firme, Garra Garfio, Gema Tierra, Lupa | Baya Zidra |
| Yakón | — | Cascabel Concha, Globo Helio, Incienso Acua (sin límite), Incienso Floral (sin límite), Incienso Lento (sin límite), Incienso Marino (sin límite), Incienso Raro (sin límite), Incienso Roca (sin límite), Incienso Suave (sin límite), Raíz Grande | Baya Algama, Baya Anjiro, Baya Grana, Baya Ispero, Baya Meluce, Baya Tamate, Baya Uvav |
| Gerania | Piedra Lunar, Piedra Día | Gema Dragón, Gema Eléctrica, Gema Voladora, Imán, Pico Afilado | — |
| Lirio | Piedra Noche, Escama Bella, Colmillo Agudo | Banda Recia ×2, Blanco, Gema Agua, Gema Fantasma, Gema Fuego, Gema Siniestra, Hechizo ×2, Lente Recia, Llamasfera, Metrónomo, Piedra Pómez, Tabla Draco, Tabla Linfa, Toxisfera, Zumo de Baya | Baya Caquic |
| Ciprián | — | — | — |
| Anís | Escama Dragón, Electrizador, Magmatizador, Garra Afilada | Colmillo de Dragón, Flecha Venenosa, Gema Hielo, Gema Normal | — |
| Aza | — | — | — |
| Catleya | — | — | — |
| Lotto | — | — | — |
| Iris | — | — | — |

## Canje de PB: tienda del Metro Batalla

Todos sus equipables con sus precios: Periscopio 8, Lupa 8, Cinta Fuerte 8, Gafas Especiales 8, Garra Afilada 8, Colmillo Agudo 8, Banda Atadura 8, Polvo Brillo 12, Cinta Aguante 12, Telescopio 12, Bola Férrea 12, Globo Helio 12, Brazal Recio 16, Cinto Recio 16, Lente Recia 16, Banda Recia 16, Franja Recia 16, Pesa Recia 16, Toxisfera 16, Llamasfera 16, Hierba Blanca 16, Hierba Única 16, Tubérculo 16, Pila 16, Tarjeta Roja 16, Botón Escape 16, Cinta Elección 24, Gafas Elección 24, Pañuelo Elección 24, Banda Focus 24, Vidasfera 24.

**PB (aprobado):** en Hoenn, 20 PB por gimnasio y 8 más si no cae nadie, con precios de 48 y 64 (160 PB pasando los gimnasios: dos o tres de los caros). Con los precios del Metro (el caro, 24), la misma proporción da **8 PB por gimnasio y 3 más sin bajas**: 64 PB en los ocho gimnasios (dos o tres de los de 24) y 88 sin bajas.

## Casos a revisar

- **Fragata Plasma** (Electrizador, Magmatizador, Banda Recia): como la MT67, en la última visita (tramo de la Liga).
- **Zumo de Baya** de Pueblo Arenisca cuenta; los de Pueblo Arcilla (después de la Liga), del martes en el Gran Tour Teselia y del minijuego de Pokéwood, no.
