/**
 * La lista de los iconos de rol, con su nombre en español, otras palabras para encontrarlos, su grupo y su autor: todos
 * los de game-icons.net (https://github.com/game-icons/icons, master del 2026-11-12; CC BY 3.0, los de Viscious Speed y
 * Zeromancer CC0), 4180 sin la carpeta «badges» (sin autor en su licencia). Los nombres en español son nuestros. Es
 * grande: la web la pide aparte (import dinámico, apps/web/src/components/game-icons.ts); el servidor, siempre, y al
 * importarse registra los ids que existen (game-icons.ts, isGameIcon). docs/terceros.md
 *
 * Cada línea: id|nombre|grupo|palabras|autor|* (destacado: de la selección de siempre, lo primero que se ve). Un id
 * repetido entre autores lleva el autor detrás («castle-delapouite»)
 */
import { type GameIcon, type GameIconGroup, gameIconId, registerGameIcons } from './game-icons.ts'

const DATA = `
archer|Arquero|gente|arco,tirador|delapouite|*
ninja-head|Asesino|gente|ninja|darkzaitzev|*
bandit|Bandido|gente|ladrón,forajido|delapouite|*
barbarian|Bárbaro|gente|guerrero,salvaje|delapouite|*
witch-face|Bruja|gente||cathelineau|*
knight-banner|Caballero|gente|estandarte|delapouite|*
cook|Cocinero|gente|chef|delapouite|*
three-friends|Compañía|gente|amigos,grupo|delapouite|*
woman-elf-face|Elfa|gente||delapouite|*
elf-helmet|Elfo|gente|yelmo,élfico|kier-heyl|*
dwarf-face|Enano|gente|rostro,barba|delapouite|*
cowled|Encapuchado|gente|capucha,monje|lorc|*
spy|Espía|gente|agente|delapouite|*
family-house|Familia|gente|hogar,casa|delapouite|*
farmer|Granjero|gente|agricultor,campesino|delapouite|*
backup|Grupo|gente|refuerzos,compañeros|lorc|*
blacksmith|Herrero|gente|forja,artesano|delapouite|*
robber-hand|Ladrón|gente|mano,robar|darkzaitzev|*
wizard-face|Mago|gente||delapouite|*
monk-face|Monje|gente||delapouite|*
person|Persona|gente||delapouite|*
pirate-captain|Pirata|gente|capitán|delapouite|*
prisoner|Prisionero|gente|preso,cautivo|delapouite|*
sun-priest|Sacerdote del sol|gente||delapouite|*
cultist|Sectario|gente|culto,secta|lorc|*
executioner-hood|Verdugo|gente|capucha,ejecución|delapouite|*
police-officer-head|Agente de policía|gente|poli,alguacil|delapouite|
lovers|Amantes|gente|pareja|delapouite|
bowman|Arquero con arco|gente|arco,tirador|lorc|
kneeling|Arrodillado|gente||delapouite|
assassin-pocket|Asesino de bolsillo|gente|asesino,pícaro|lorc|
hooded-assassin|Asesino encapuchado|gente|asesino,pícaro|darkzaitzev|
robber|Atracador|gente|bandido|delapouite|
apothecary|Boticario|gente|farmacéutico,alquimista|darkzaitzev|
brute|Bruto|gente|matón,forzudo|delapouite|
philosopher-bust|Busto de filósofo|gente||caro-asercion|
cavalry|Caballería|gente|jinetes,ejército|delapouite|
mounted-knight|Caballero montado|gente||skoll|
viking-head|Cabeza de vikingo|gente||delapouite|
corporal|Cabo|gente|soldado,militar|delapouite|
champions|Campeones|gente|héroes,guerreros|delapouite|
captain-hat-profile|Capitán de perfil|gente|gorra,marino|delapouite|
warlock-hood|Capucha de brujo|gente||delapouite|
face-to-face|Cara a cara|gente|enfrentamiento,duelo|delapouite|
baby-face|Cara de bebé|gente|niño,bebé|delapouite|
nun-face|Cara de monja|gente||cathelineau|
invisible-face|Cara invisible|gente|anónimo,invisibilidad|delapouite|
caveman|Cavernícola|gente|troglodita,prehistórico|delapouite|
caesar|César|gente|emperador,romano|delapouite|
high-five|Choca esos cinco|gente|saludo,manos|lorc|
mad-scientist|Científico loco|gente||lorc|
cleopatra|Cleopatra|gente|egipcia,reina|delapouite|
congress|Congreso|gente|reunión,asamblea|delapouite|
conqueror|Conquistador|gente|guerrero,casco|delapouite|
contortionist|Contorsionista|gente|acróbata,circo|delapouite|
coronation|Coronación|gente|rey,corona|delapouite|
discobolus|Discóbolo|gente|atleta,estatua|delapouite|
imprisoned|Encarcelado|gente|preso,celda|lorc|
nurse-female|Enfermera|gente||delapouite|
nurse-male|Enfermero|gente||delapouite|
bully-minion|Esbirro matón|gente|esbirro,matón|delapouite|
dark-squad|Escuadrón oscuro|gente|soldados,sombras|lorc|
fencer|Esgrimista|gente|esgrima,florete|delapouite|
swordman|Espadachín|gente||cathelineau|
swordwoman|Espadachina|gente||cathelineau|
spartan|Espartano|gente|guerrero|lorc|
walking-scout|Explorador caminando|gente||delapouite|
pharoah|Faraón|gente||delapouite|
hooded-figure|Figura encapuchada|gente|misterioso,capa|darkzaitzev|
mug-shot|Foto de ficha policial|gente||delapouite|
bad-gnome|Gnomo malvado|gente|gnomo,duende|cathelineau|
door-watcher|Guardián de la puerta|gente|vigilante,centinela|delapouite|
guards|Guardias|gente|vigilantes,soldados|delapouite|
william-tell|Guillermo Tell|gente|manzana|lorc|
tinker|Hojalatero|gente||lorc|
male|Hombre|gente||delapouite|
air-man|Hombre aire|gente|viento,héroe|delapouite|
human-cannonball|Hombre bala|gente|circo,cañón|delapouite|
vitruvian-man|Hombre de Vitruvio|gente||delapouite|
strong-man|Hombre fuerte|gente|forzudo|delapouite|
magnet-man|Hombre imán|gente||delapouite|
quick-man|Hombre veloz|gente|rápido,corredor|delapouite|
icarus|Ícaro|gente|alas,mito|delapouite|
inauguration|Inauguración|gente|corte de cinta,ceremonia|delapouite|
cloaked-figure-on-horseback|Jinete encapuchado|gente|caballo,sombra|caro-asercion|
american-football-player|Jugador de fútbol americano|gente|deportista|delapouite|
luchador|Luchador enmascarado|gente||delapouite|
heavy-fighter|Luchador pesado|gente|guerrero,combatiente|lord-berandas|
teacher|Maestro|gente|profesor|delapouite|
master-of-arms|Maestro de armas|gente||lorc|
ringmaster|Maestro de ceremonias|gente|circo|delapouite|
juggler|Malabarista|gente|circo,artista|lorc|
egyptian-walk|Marcha egipcia|gente|jeroglífico|delapouite|
king-ju-mask|Máscara del rey Ju|gente||delapouite|
medallist|Medallista|gente||delapouite|
doctor-face|Médico|gente|doctor,sanador|lorc|
plague-doctor-profile|Médico de la peste|gente||delapouite|
meditation|Meditación|gente||lorc|
liar|Mentiroso|gente||delapouite|
miner|Minero|gente||delapouite|
nefertiti|Nefertiti|gente||delapouite|
running-ninja|Ninja corriendo|gente|asesino|darkzaitzev|
public-speaker|Orador|gente|discurso,oratoria|delapouite|
clown|Payaso|gente|circo,bufón|delapouite|
egyptian-profile|Perfil egipcio|gente|faraón|delapouite|
person-in-bed|Persona en la cama|gente||delapouite|
person-in-blizzard|Persona en la ventisca|gente||lorc|
character|Personaje|gente|silueta,persona|delapouite|
lucky-fisherman|Pescador afortunado|gente||delapouite|
pianist|Pianista|gente||caro-asercion|
rogue|Pícaro|gente|ladrón|lorc|
plane-pilot|Piloto de avión|gente||delapouite|
pikeman|Piquero|gente||delapouite|
human-pyramid|Pirámide humana|gente|acróbatas,torre|delapouite|
pyromaniac|Pirómano|gente|fuego,incendiario|lorc|
goal-keeper|Portero|gente|fútbol,deporte|delapouite|
ninja-heroic-stance|Postura heroica ninja|gente||darkzaitzev|
convict|Presidiario|gente|preso,prisionero|delapouite|
new-born|Recién nacido|gente|bebé|delapouite|
explosive-meeting|Reunión explosiva|gente|discusión,debate|lorc|
king|Rey|gente|monarca|lorc|
old-king|Rey anciano|gente||cathelineau|
dwarf-king|Rey enano|gente|enano,corona|kier-heyl|
cultist-skoll|Sectario encapuchado|gente|culto,secta|skoll|
hiking|Senderismo|gente|excursión,caminante|delapouite|
sherlock-holmes|Sherlock Holmes|gente|detective|delapouite|
fire-silhouette|Silueta en llamas|gente|ardiendo,fuego|lorc|
flamethrower-soldier|Soldado con lanzallamas|gente|fuego,militar|delapouite|
tribunal-jury|Tribunal|gente|jurado|delapouite|
troglodyte|Troglodita|gente||delapouite|
witch-flight|Vuelo de bruja|gente|escoba|lorc|
spectre|Aparición|criaturas|espectro,fantasma|lorc|*
centaur|Centauro|criaturas|caballo|delapouite|*
cyclops|Cíclope|criaturas|gigante|lorc|*
horned-skull|Cráneo con cuernos|criaturas|calavera,demonio|lorc|*
devil-mask|Demonio|criaturas|máscara,diablo|delapouite|*
imp|Diablillo|criaturas|demonio,duende|lorc|*
dragon-head|Dragón|criaturas|cabeza|lorc|*
ghost|Espectro|criaturas|fantasma,aparición|lorc|*
skeleton|Esqueleto|criaturas|muerto viviente|skoll|*
haunting|Fantasma|criaturas|espectro,aparición|lorc|*
gargoyle|Gárgola|criaturas|estatua,monstruo|delapouite|*
goblin-head|Goblin|criaturas|trasgo,cabeza|delapouite|*
golem-head|Gólem|criaturas|autómata,cabeza|delapouite|*
wyvern|Guiverno|criaturas|dragón|lorc|*
fairy|Hada|criaturas|duende,alas|lorc|*
hydra|Hidra|criaturas|serpiente,monstruo|lorc|*
werewolf|Hombre lobo|criaturas|licántropo|lorc|*
kraken-tentacle|Kraken|criaturas|tentáculo|delapouite|*
slime|Limo|criaturas|baba,moco|delapouite|*
minotaur|Minotauro|criaturas||lorc|*
ogre|Ogro|criaturas||delapouite|*
orc-head|Orco|criaturas||delapouite|*
pegasus|Pegaso|criaturas|caballo alado|skoll|*
crowned-skull|Rey muerto|criaturas|calavera,rey|lorc|*
sea-serpent|Serpiente marina|criaturas|monstruo|lorc|*
mermaid|Sirena|criaturas||delapouite|*
tentacle-strike|Tentáculos|criaturas||lorc|*
troll|Trol|criaturas||skoll|*
unicorn|Unicornio|criaturas||delapouite|*
vampire-dracula|Vampiro|criaturas|drácula|delapouite|*
shambling-zombie|Zombi|criaturas|muerto viviente|delapouite|*
spiky-wing|Ala espinosa|criaturas|alas|delapouite|
curly-wing|Ala rizada|criaturas|ala|lorc|
fairy-wings|Alas de hada|criaturas|alas,duende|delapouite|
evil-wings|Alas malignas|criaturas|alas|sbed|
ghost-ally|Aliado fantasma|criaturas|espectro,invocación|lorc|
tree-face|Árbol con cara|criaturas|ent|cathelineau|
harpy|Arpía|criaturas|mujer pájaro,monstruo|lorc|
dripping-goo|Baba goteante|criaturas|slime,viscoso|lorc|
grasping-slug|Babosa agarrando|criaturas|baba,monstruo|delapouite|
tentacles-barrier|Barrera de tentáculos|criaturas||delapouite|
alien-bug|Bicho alienígena|criaturas|insecto,extraterrestre|delapouite|
carnivore-mouth|Boca carnívora|criaturas|dientes,monstruo|lorc|
ent-mouth|Boca de ent|criaturas|árbol,tronco|lorc|
worm-mouth|Boca de gusano|criaturas||lorc|
evil-bud|Brote maligno|criaturas|planta|lorc|
squid-head|Cabeza de calamar|criaturas|cefalópodo|lorc|
spiked-dragon-head|Cabeza de dragón con púas|criaturas|dragón|delapouite|
metal-golem-head|Cabeza de gólem de metal|criaturas||delapouite|
kenku-head|Cabeza de kenku|criaturas|pájaro,cuervo|delapouite|
medusa-head|Cabeza de medusa|criaturas|gorgona|cathelineau|
mummy-head|Cabeza de momia|criaturas||delapouite|
triceratops-head|Cabeza de tricerátops|criaturas|dinosaurio|delapouite|
triton-head|Cabeza de tritón|criaturas||lorc|
tentacles-skull|Calavera con tentáculos|criaturas||lorc|
sharped-teeth-skull|Calavera de dientes afilados|criaturas|cráneo|lorc|
dread-skull|Calavera del terror|criaturas|miedo,cráneo|lorc|
daemon-skull|Calavera demoníaca|criaturas|demonio,cráneo|lorc|
burning-skull|Calavera en llamas|criaturas|calavera,fuego|skoll|
vampire-cape|Capa de vampiro|criaturas||delapouite|
armoured-shell|Caparazón blindado|criaturas|concha,tortuga|lorc|
spiked-snail|Caracol de púas|criaturas|monstruo|lorc|
brain-tentacle|Cerebro con tentáculo|criaturas|cerebro,tentáculo|delapouite|
goo-spurt|Chorro de baba|criaturas|slime,salpicadura|lorc|
jawless-cyclop|Cíclope sin mandíbula|criaturas|monstruo,ojo|delapouite|
fangs-circle|Círculo de colmillos|criaturas|mordisco,dientes|lorc|
mimic-chest|Cofre mímico|criaturas||delapouite|
fire-tail|Cola de fuego|criaturas|llamas,cola|lorc|
spiked-tail|Cola de púas|criaturas|monstruo|lorc|
bestial-fangs|Colmillos bestiales|criaturas|colmillos,mordisco|lorc|
tentacle-heart|Corazón con tentáculos|criaturas||lorc|
alien-skull|Cráneo alienígena|criaturas|extraterrestre,calavera|lorc|
cracked-alien-skull|Cráneo alienígena roto|criaturas|extraterrestre|lorc|
fanged-skull|Cráneo con colmillos|criaturas|calavera,vampiro|lorc|
animal-skull|Cráneo de animal|criaturas|calavera,hueso|lorc|
goo-skull|Cráneo de baba|criaturas|calavera,slime|lorc|
diablo-skull|Cráneo de diablo|criaturas|demonio,calavera|lorc|
t-rex-skull|Cráneo de tiranosaurio|criaturas|dinosaurio|delapouite|
frankenstein-creature|Criatura de Frankenstein|criaturas|monstruo,cosido|lorc|
sea-creature|Criatura marina|criaturas|monstruo|skoll|
gooey-daemon|Demonio pegajoso|criaturas|demonio,baba|lorc|
double-dragon|Dragón doble|criaturas|dragones|lorc|
sea-dragon|Dragón marino|criaturas|monstruo|lorc|
minions|Esbirros|criaturas||lorc|
dorsal-scales|Escamas dorsales|criaturas|espinas,lomo|lorc|
egyptian-sphinx|Esfinge|criaturas|egipto|delapouite|
greek-sphinx|Esfinge griega|criaturas|monstruo,enigma|delapouite|
dragon-spiral|Espiral de dragón|criaturas|dragón,serpiente|lorc|
spark-spirit|Espíritu chispa|criaturas|elemental|lorc|
goo-explosion|Explosión de baba|criaturas|slime,estallido|lorc|
floating-ghost|Fantasma flotante|criaturas|espectro,aparición|delapouite|
fomorian|Fomoriano|criaturas|gigante,monstruo|cathelineau|
grasping-claws|Garras agarrando|criaturas|zarpas,presa|lorc|
interleaved-claws|Garras entrelazadas|criaturas|zarpas,monstruo|lorc|
djinn|Genio|criaturas|djinn,lámpara|delapouite|
giant|Gigante|criaturas|titán,coloso|delapouite|
goblin|Goblin entero|criaturas|trasgo,duende|caro-asercion|
ice-golem|Gólem de hielo|criaturas|autómata,escarcha|delapouite|
rock-golem|Gólem de roca|criaturas|piedra|delapouite|
falling-blob|Gota cayendo|criaturas|slime,baba|lorc|
fairy-delapouite|Hada con alas|criaturas|duende,alas|delapouite|
lizardman|Hombre lagarto|criaturas|reptil|lorc|
octoman|Hombre pulpo|criaturas||lorc|
velociraptor-tracks|Huellas de velociraptor|criaturas||delapouite|
alien-egg|Huevo alienígena|criaturas|extraterrestre,huevo|delapouite|
ifrit|Ifrit|criaturas|genio,fuego|lorc|
transparent-slime|Limo transparente|criaturas|slime|cathelineau|
acid-blob|Mancha de ácido|criaturas|baba,moco|lorc|
burst-blob|Mancha reventada|criaturas|baba,explosión|lorc|
insect-jaws|Mandíbulas de insecto|criaturas|mordisco,bicho|lorc|
hand-wing|Mano alada|criaturas|ala,mano|delapouite|
evil-hand|Mano maligna|criaturas|garra|lorc|
fleshy-mass|Masa de carne|criaturas|bulto,monstruosidad|lorc|
infested-mass|Masa infestada|criaturas|plaga,bulto|lorc|
slow-blob|Masa lenta|criaturas|baba|sbed|
hive-mind|Mente colmena|criaturas|insectos,enjambre|delapouite|
overmind|Mente suprema|criaturas||sbed|
metroid|Metroid|criaturas||delapouite|
alien-stare|Mirada alienígena|criaturas|extraterrestre,ojo|lorc|
fish-monster|Monstruo pez|criaturas|pez,hombre pez|delapouite|
shambling-mound|Montículo errante|criaturas|planta,monstruo|delapouite|
neck-bite|Mordisco en el cuello|criaturas|vampiro|delapouite|
evil-bat|Murciélago maligno|criaturas|murciélago|lorc|
beast-eye|Ojo de bestia|criaturas|ojo,monstruo|lorc|
egg-eye|Ojo de huevo|criaturas|huevo|delapouite|
evil-eyes|Ojos malignos|criaturas|mirada|skoll|
oni|Oni|criaturas|demonio|delapouite|
gloop|Pegote|criaturas|slime,baba|lorc|
ceiling-barnacle|Percebe del techo|criaturas|monstruo,molusco|delapouite|
mucous-pillar|Pilar mucoso|criaturas||lorc|
stegosaurus-scales|Placas de estegosaurio|criaturas|dinosaurio|delapouite|
frog-prince|Príncipe rana|criaturas|cuento,sapo|delapouite|
imp-laugh|Risa de diablillo|criaturas|demonio,burla|lorc|
bone-gnawer|Roedor de huesos|criaturas|hueso,carroñero|lorc|
sasquatch|Sasquatch|criaturas|yeti,bigfoot|delapouite|
evil-minion|Secuaz maligno|criaturas|esbirro|lorc|
shadow-follower|Seguidor de sombras|criaturas|sombra|lorc|
six-eyes|Seis ojos|criaturas|monstruo|lorc|
gooey-eyed-sun|Sol de ojos pegajosos|criaturas|baba,ojos|lorc|
eyestalk|Tallo ocular|criaturas|ojo,tentáculo|lorc|
ringed-tentacle|Tentáculo con anillos|criaturas|monstruo|delapouite|
suckered-tentacle|Tentáculo con ventosas|criaturas||lorc|
spiked-tentacle|Tentáculo de púas|criaturas|monstruo|lorc|
spiral-tentacle|Tentáculo en espiral|criaturas|monstruo|lorc|
curled-tentacle|Tentáculo enroscado|criaturas|pulpo|lorc|
thorny-tentacle|Tentáculo espinoso|criaturas||lorc|
purple-tentacle|Tentáculo morado|criaturas|monstruo|delapouite|
tentacurl|Tentáculo rizado|criaturas||lorc|
interlaced-tentacles|Tentáculos entrelazados|criaturas|monstruo,kraken|lorc|
floating-tentacles|Tentáculos flotantes|criaturas|tentáculos,monstruo|delapouite|
swallower|Tragón|criaturas||delapouite|
triple-beak|Triple pico|criaturas||lorc|
spiked-trunk|Trompa de púas|criaturas|monstruo|delapouite|
egg-pod|Vaina de huevos|criaturas|huevo,alien|sbed|
resting-vampire|Vampiro durmiente|criaturas|descanso,ataúd|delapouite|
velociraptor|Velociraptor|criaturas|dinosaurio|delapouite|
ninja-velociraptor|Velociraptor ninja|criaturas||delapouite|
monster-grasp|Zarpa de monstruo|criaturas||lorc|
eagle-head|Águila|animales|cabeza,ave|delapouite|*
bat-wing|Alas de murciélago|animales|alas,murciélago|lorc|*
spider-alt|Araña|animales|arácnido|carl-olsen|*
wolf-howl|Aullido|animales||lorc|*
owl|Búho|animales||lorc|*
horse-head|Caballo|animales|cabeza,corcel|lorc|*
stag-head|Ciervo|animales|cabeza,venado|lorc|*
raven|Cuervo|animales|ave|lorc|*
beetle-shell|Escarabajo|animales|caparazón,insecto|lorc|*
scorpion|Escorpión|animales|alacrán|lorc|*
cat|Gato|animales|felino|lorc|*
egg-clutch|Huevos|animales|puesta,nido|lorc|*
boar|Jabalí|animales|cerdo salvaje|caro-asercion|*
lion|León|animales||lorc|*
wolf-head|Lobo|animales||lorc|*
bat|Murciélago|animales|quiróptero|delapouite|*
bear-head|Oso|animales|cabeza de oso|delapouite|*
tropical-fish|Pez|animales|tropical|delapouite|*
octopus|Pulpo|animales||lorc|*
rat|Rata|animales|roedor|delapouite|*
snake|Serpiente|animales|culebra|lorc|*
shark-fin|Tiburón|animales|aleta|delapouite|*
bee|Abeja|animales|insecto,miel|lorc|
mite|Ácaro|animales||lorc|
mite-alt|Ácaro alternativo|animales||carl-olsen|
wasp-sting|Aguijón de avispa|animales||lorc|
axolotl|Ajolote|animales|anfibio,salamandra|caro-asercion|
feathered-wing|Ala con plumas|animales|ave,ala|lorc|
fluffy-wing|Ala esponjosa|animales|ala,plumas|lorc|
ammonite|Amonita|animales|fósil,concha|lorc|
eel|Anguila|animales|pez|delapouite|
angular-spider|Araña angular|animales|araña,insecto|lorc|
hanging-spider|Araña colgando|animales|arácnido,hilo|lorc|
long-legged-spider|Araña de patas largas|animales||skoll|
masked-spider|Araña enmascarada|animales||lorc|
squirrel|Ardilla|animales|roedor|delapouite|
armadillo|Armadillo|animales|coraza|delapouite|
ermine|Armiño|animales|mustélido|delapouite|
ostrich|Avestruz|animales||delapouite|
butterfly-warning|Aviso de mariposa|animales|mariposa,advertencia|lorc|
school-of-fish|Banco de peces|animales|peces|delapouite|
spotted-bug|Bicho moteado|animales|insecto|skoll|
bison|Bisonte|animales|búfalo|delapouite|
lamprey-mouth|Boca de lamprea|animales||lorc|
vulture|Buitre|animales||lorc|
donkey|Burro|animales|asno|skoll|
seahorse|Caballito de mar|animales|pez|delapouite|
basset-hound-head|Cabeza de basset|animales|perro,sabueso|delapouite|
buffalo-head|Cabeza de búfalo|animales|bisonte,búfalo|delapouite|
horse-head-delapouite|Cabeza de caballo|animales|corcel,equino|delapouite|
camel-head|Cabeza de camello|animales|camello,dromedario|delapouite|
cassowary-head|Cabeza de casuario|animales|ave|delapouite|
deer-head|Cabeza de ciervo|animales|venado,cornamenta|caro-asercion|
rabbit-head|Cabeza de conejo|animales|liebre|delapouite|
elephant-head|Cabeza de elefante|animales|trompa|delapouite|
hyena-head|Cabeza de hiena|animales|carroñero,cabeza|caro-asercion|
labrador-head|Cabeza de labrador|animales|perro|delapouite|
lynx-head|Cabeza de lince|animales||delapouite|
parrot-head|Cabeza de loro|animales||lorc|
mandrill-head|Cabeza de mandril|animales|mono|delapouite|
raccoon-head|Cabeza de mapache|animales|mapache|delapouite|
walrus-head|Cabeza de morsa|animales||delapouite|
sauropod-head|Cabeza de saurópodo|animales|dinosaurio|delapouite|
tiger-head|Cabeza de tigre|animales||delapouite|
saber-toothed-cat-head|Cabeza de tigre dientes de sable|animales|smilodon|delapouite|
fox-head|Cabeza de zorro|animales|raposa|lorc|
goat|Cabra|animales|chivo,cabrito|skoll|
sperm-whale|Cachalote|animales|ballena|delapouite|
squid|Calamar|animales|molusco|lorc|
giant-squid|Calamar gigante|animales|kraken,cefalópodo|delapouite|
skull-sabertooth|Calavera de dientes de sable|animales|cráneo|darkzaitzev|
camel|Camello|animales|dromedario|delapouite|
crab|Cangrejo|animales|crustáceo|lorc|
sad-crab|Cangrejo triste|animales|marisco|lorc|
kangaroo|Canguro|animales|marsupial,australia|delapouite|
spiked-shell|Caparazón de púas|animales|tortuga|lorc|
turtle-shell|Caparazón de tortuga|animales||lorc|
capybara|Capibara|animales|roedor|caro-asercion|
spider-face|Cara de araña|animales|arácnido|carl-olsen|
pig-face|Cara de cerdo|animales||lorc|
bear-face|Cara de oso|animales|oso,rostro|sparker|
snail|Caracol|animales|molusco|lorc|
spiral-shell|Caracola|animales|concha|lorc|
ram|Carnero|animales|oveja,cuernos|lorc|
ram-darkzaitzev|Carnero de frente|animales|oveja,cuernos|darkzaitzev|
ram-profile|Carnero de perfil|animales|oveja,cuernos|delapouite|
carrion|Carroña|animales|buitre,cadáver|lorc|
beaver|Castor|animales|roedor|delapouite|
pig|Cerdo|animales||skoll|
centipede|Ciempiés|animales|insecto|lorc|
cigale|Cigarra|animales|insecto,chicharra|delapouite|
stork-delivery|Cigüeña con bebé|animales||delapouite|
swan|Cisne|animales||lorc|
swan-breeze|Cisne al viento|animales||lorc|
cobra|Cobra|animales|serpiente|delapouite|
cobra-skoll|Cobra erguida|animales|serpiente|skoll|
armadillo-tail|Cola de armadillo|animales|armadillo,cola|lorc|
whale-tail|Cola de ballena|animales||delapouite|
scorpion-tail|Cola de escorpión|animales|aguijón|lorc|
fox-tail|Cola de zorro|animales|raposa,cola|delapouite|
hummingbird|Colibrí|animales|ave,pájaro|delapouite|
hive|Colmena silvestre|animales|abejas,panal|sbed|
saber-tooth|Colmillo de sable|animales|diente|lorc|
boar-tusks|Colmillos de jabalí|animales|colmillos,jabalí|lorc|
ivory-tusks|Colmillos de marfil|animales|elefante,marfil|delapouite|
opening-shell|Concha abierta|animales||lorc|
nautilus-shell|Concha de nautilo|animales||faithtoken|
twin-shell|Concha doble|animales||lorc|
swirled-shell|Concha espiral|animales|caracola|skoll|
rabbit|Conejo|animales|liebre|delapouite|
condylura-skull|Cráneo de topo nariz estrellada|animales|topo|lorc|
rhinoceros-horn|Cuerno de rinoceronte|animales|cuerno|delapouite|
bull-horns|Cuernos de toro|animales|cuernos,toro|lorc|
dolphin|Delfín|animales|mamífero marino|delapouite|
toad-teeth|Dientes de sapo|animales||lorc|
dimetrodon|Dimetrodon|animales|dinosaurio,reptil|delapouite|
diplodocus|Diplodocus|animales|dinosaurio|delapouite|
dodo|Dodo|animales|ave|caro-asercion|
elephant|Elefante|animales|paquidermo|delapouite|
hedgehog|Erizo|animales|púas|caro-asercion|
sea-urchin|Erizo de mar|animales|marisco|delapouite|
fish-scales|Escamas de pez|animales|escamas|delapouite|
scarab-beetle|Escarabajo sagrado|animales|escarabeo|lorc|
flying-beetle|Escarabajo volador|animales|insecto,coleóptero|delapouite|
fishbone|Espina de pescado|animales|raspa,pez|lorc|
sauropod-skeleton|Esqueleto de saurópodo|animales|dinosaurio|caro-asercion|
sea-star|Estrella de mar|animales|marisco|delapouite|
staryu|Estrella de mar de juguete|animales||lorc|
feline|Felino|animales|gato,felino|delapouite|
flamingo|Flamenco|animales|ave,rosa|delapouite|
juggling-seal|Foca malabarista|animales|circo,pelota|delapouite|
archaeopteryx-fossil|Fósil de arqueópterix|animales|fósil,dinosaurio|caro-asercion|
chicken|Gallina|animales|pollo,ave|delapouite|
rooster|Gallo|animales|ave|delapouite|
shrimp|Gamba|animales|marisco|delapouite|
goose|Ganso|animales|oca,ave|delapouite|
canadian-goose|Ganso canadiense|animales|ganso,ave|caro-asercion|
bird-claw|Garra de ave|animales|garra,zarpa|lorc|
tick|Garrapata|animales||lorc|
heron|Garza|animales|ave,zancuda|caro-asercion|
schrodingers-cat-dead|Gato de Schrödinger muerto|animales|gato|caro-asercion|
schrodingers-cat-alive|Gato de Schrödinger vivo|animales|gato|caro-asercion|
hollow-cat|Gato hueco|animales|felino,silueta|lorc|
seagull|Gaviota|animales|ave|delapouite|
gecko|Gecko|animales|lagartija,reptil|lorc|
chameleon-glyph|Glifo de camaleón|animales|reptil|darkzaitzev|
swallow|Golondrina|animales|ave|lorc|
swallow-delapouite|Golondrina en vuelo|animales|ave|delapouite|
gorilla|Gorila|animales|simio,mono|delapouite|
sparrow|Gorrión|animales|ave|lorc|
cricket|Grillo|animales|insecto|delapouite|
crane|Grulla|animales|ave|delapouite|
maggot|Gusano|animales|larva|lorc|
worms|Gusanos|animales||delapouite|
falcon-moon|Halcón y luna|animales|ave,rapaz|delapouite|
helicoprion|Helicoprión|animales|tiburón,prehistórico|delapouite|
ant|Hormiga|animales|insecto|delapouite|
ants|Hormigas|animales|insectos,colonia|delapouite|
deer-track|Huella de ciervo|animales|rastro|delapouite|
flat-paw-print|Huella de garra|animales|rastro,pata|lorc|
paw-print|Huella de pata|animales|rastro|lorc|
dinosaur-bones|Huesos de dinosaurio|animales|fósil,esqueleto|lorc|
fish-eggs|Huevas de pescado|animales|huevos,caviar|delapouite|
dinosaur-egg|Huevo de dinosaurio|animales|huevo|lorc|
snake-egg|Huevo de serpiente|animales|reptil|delapouite|
ibis|Ibis|animales|ave,egipcio|delapouite|
long-antennae-bug|Insecto de antenas largas|animales||lorc|
kiwi-bird|Kiwi|animales|ave|delapouite|
koala|Koala|animales||delapouite|
barn-owl|Lechuza|animales|búho,ave|caro-asercion|
lizard-tongue|Lengua de lagarto|animales||lorc|
snake-tongue|Lengua de serpiente|animales|bífida|delapouite|
dragonfly|Libélula|animales|insecto|lorc|
direwolf|Lobo huargo|animales|lobo,huargo|lorc|
earth-worm|Lombriz|animales|gusano|cathelineau|
mammoth|Mamut|animales||delapouite|
needle-jaws|Mandíbulas de aguja|animales||lorc|
croc-jaws|Mandíbulas de cocodrilo|animales|dientes|lorc|
shark-jaws|Mandíbulas de tiburón|animales|dientes|lorc|
manta-ray|Manta raya|animales||delapouite|
praying-mantis|Mantis religiosa|animales|insecto|delapouite|
butterfly|Mariposa|animales|insecto|lorc|
ladybug|Mariquita|animales|insecto|delapouite|
jellyfish|Medusa|animales|mar,tentáculos|lorc|
mussel|Mejillón|animales||delapouite|
monkey|Mono|animales||lorc|
fly|Mosca|animales|insecto|delapouite|
amber-mosquito|Mosquito en ámbar|animales|insecto,fósil|delapouite|
swamp-bat|Murciélago del pantano|animales||delapouite|
bat-skoll|Murciélago heráldico|animales|murciélago,emblema|skoll|
moon-bats|Murciélagos lunares|animales||delapouite|
nest-eggs|Nido con huevos|animales||delapouite|
nest-birds|Nido de pájaros|animales||delapouite|
spider-eye|Ojo de araña|animales|arácnido|delapouite|
snail-eyes|Ojos de caracol|animales|molusco|delapouite|
caterpillar|Oruga|animales|larva,insecto|delapouite|
anteater|Oso hormiguero|animales|hormiguero|caro-asercion|
polar-bear|Oso polar|animales|oso,hielo|cathelineau|
oyster|Ostra|animales||delapouite|
sheep|Oveja|animales|cordero|delapouite|
bird-twitter|Pájaro piador|animales|ave,piar|lorc|
dove|Paloma|animales|ave,paz|lorc|
freedom-dove|Paloma de la libertad|animales|paz,ave|lorc|
peace-dove|Paloma de la paz|animales||delapouite|
panda|Panda|animales||delapouite|
pangolin|Pangolín|animales||caro-asercion|
parmecia|Paramecio|animales||lorc|
parasaurolophus|Parasaurolofo|animales|dinosaurio|delapouite|
paw|Pata|animales||lorc|
paw-heart|Pata con corazón|animales||lorc|
bird-limb|Pata de ave|animales|pata,extremidad|lorc|
paw-front|Pata de frente|animales||lorc|
frog-foot|Pata de rana|animales|anfibio,pie|delapouite|
duck|Pato|animales|ave|delapouite|
duck-palm|Pato en la palma|animales|mano|delapouite|
circling-fish|Peces en círculo|animales|banco|delapouite|
double-fish|Peces gemelos|animales|piscis|delapouite|
eating-pelican|Pelícano comiendo|animales|ave|delapouite|
sloth|Perezoso|animales|mamífero|caro-asercion|
sniffing-dog|Perro olfateando|animales|rastro|delapouite|
jumping-dog|Perro saltando|animales|can,salto|delapouite|
sitting-dog|Perro sentado|animales|can|delapouite|
fish-escape|Pez escapando|animales|pez,saltar|delapouite|
porcupinefish|Pez globo espinoso|animales|pez erizo|delapouite|
fish-corpse|Pez muerto|animales|esqueleto,pescado|lorc|
clownfish|Pez payaso|animales|pez,anémona|delapouite|
flatfish|Pez plano|animales|lenguado,pescado|delapouite|
hoof|Pezuña|animales|casco,caballo|lorc|
shoebill-stork|Picozapato|animales|ave|delapouite|
penguin|Pingüino|animales||delapouite|
crab-claw|Pinza de cangrejo|animales|crustáceo|lorc|
finch|Pinzón|animales|pájaro,ave|delapouite|
piranha|Piraña|animales|pez|delapouite|
plesiosaurus|Plesiosaurio|animales|dinosaurio,reptil marino|delapouite|
pterodactylus|Pterodáctilo|animales|dinosaurio,pterosaurio|delapouite|
porcupine|Puercoespín|animales|erizo|caro-asercion|
frog|Rana|animales|anfibio,sapo|lorc|
angler-fish|Rape|animales|pez abisal,pez|lorc|
mouse|Ratón|animales||lorc|
mouse-delapouite|Ratón de campo|animales||delapouite|
seated-mouse|Ratón sentado|animales|roedor|lorc|
tadpole|Renacuajo|animales||delapouite|
horned-reptile|Reptil con cuernos|animales|lagarto,cuernos|delapouite|
hound|Sabueso|animales|perro,caza|lorc|
salamander|Salamandra|animales|anfibio|lorc|
salmon|Salmón|animales|pez|various-artists|
leeching-worm|Sanguijuela|animales|gusano|lorc|
sand-snake|Serpiente de arena|animales|desierto|delapouite|
rattlesnake|Serpiente de cascabel|animales|víbora|delapouite|
snake-spiral|Serpiente enroscada|animales|espiral|delapouite|
tapir|Tapir|animales||delapouite|
badger|Tejón|animales|mamífero|caro-asercion|
spider-web|Telaraña|animales|red|lorc|
tiger|Tigre|animales||delapouite|
earwig|Tijereta|animales|insecto|lorc|
dinosaur-rex|Tiranosaurio|animales|dinosaurio,t-rex|lorc|
mole|Topo|animales||caro-asercion|
bull|Toro|animales|vacuno|lorc|
charging-bull|Toro embistiendo|animales|embestida|delapouite|
turtle|Tortuga|animales||lorc|
sea-turtle|Tortuga marina|animales|reptil|delapouite|
tortoise|Tortuga terrestre|animales||delapouite|
triple-shells|Tres conchas|animales||lorc|
trilobite|Trilobites|animales|fósil|lorc|
flying-trout|Trucha saltando|animales|pez,salto|cathelineau|
toucan|Tucán|animales||delapouite|
udder|Ubre|animales||delapouite|
cow|Vaca|animales|ganado|delapouite|
deer|Venado|animales|venado|caro-asercion|
scallop|Vieira|animales|concha|lorc|
top-paw|Zarpa|animales||lorc|
fox|Zorro|animales|raposa|caro-asercion|
flying-fox|Zorro volador|animales|murciélago,frugívoro|delapouite|
evil-tree|Árbol muerto|naturaleza|árbol siniestro|lorc|*
forest|Bosque|naturaleza|árboles,selva|delapouite|*
waterfall|Cascada|naturaleza||delapouite|*
star-formation|Constelación|naturaleza|estrellas|delapouite|*
crystal-cluster|Cristales|naturaleza|minerales,cuarzo|lorc|*
desert|Desierto|naturaleza|dunas,arena|delapouite|*
flowers|Flores|naturaleza|ramo,plantas|lorc|*
fire|Fuego|naturaleza|llama,hoguera|sbed|*
ice-cube|Hielo|naturaleza|cubito,escarcha|lorc|*
campfire|Hoguera|naturaleza|fuego,fogata|lorc|*
vine-leaf|Hoja|naturaleza||lorc|*
footprint|Huellas|naturaleza|pisadas,rastro|lorc|*
flame|Llama|naturaleza|fuego|carl-olsen|*
heavy-rain|Lluvia|naturaleza|lluvia fuerte,tormenta|lorc|*
moon|Luna|naturaleza||lorc|*
big-wave|Mar|naturaleza|ola,océano|lorc|*
snowflake-1|Nieve|naturaleza|copo|lorc|*
night-sky|Noche|naturaleza|cielo,estrellas|lorc|*
fluffy-cloud|Nube|naturaleza|cielo,clima|lorc|*
stone-pile|Piedras|naturaleza||delapouite|*
pine-tree|Pino|naturaleza|árbol|lorc|*
tree-branch|Rama|naturaleza||lorc|*
heavy-lightning|Rayo|naturaleza|relámpago,tormenta|lorc|*
oak|Roble|naturaleza|árbol|lorc|*
rose|Rosa|naturaleza|flor|lorc|*
mushroom|Seta|naturaleza|hongo|lorc|*
sun|Sol|naturaleza|astro|lorc|*
lightning-storm|Tormenta|naturaleza|rayos|lorc|*
tornado|Tornado|naturaleza||lorc|*
volcano|Volcán|naturaleza||lorc|*
birch-trees|Abedules|naturaleza|árboles,bosque|caro-asercion|
agave|Agave|naturaleza|planta,cactus|delapouite|
wind-hole|Agujero de viento|naturaleza||lorc|
algae|Algas|naturaleza|alga,mar|delapouite|
sunrise|Amanecer|naturaleza||lorc|
sunrise-delapouite|Amanecer en el mar|naturaleza||delapouite|
poppy|Amapola|naturaleza|flor|quoting|
ammonite-fossil|Amonita fosilizada|naturaleza|fósil,concha|lorc|
cloud-ring|Anillo de nubes|naturaleza|círculo|lorc|
tree-beehive|Árbol con colmena|naturaleza|abejas|delapouite|
deku-tree|Árbol deku|naturaleza|árbol,espíritu|delapouite|
burning-tree|Árbol en llamas|naturaleza|fuego,árbol|lorc|
fruit-tree|Árbol frutal|naturaleza|fruta,árbol|delapouite|
berry-bush|Arbusto de bayas|naturaleza|bayas,arbusto|delapouite|
quicksand|Arenas movedizas|naturaleza|trampa,desierto|lorc|
asteroid|Asteroide|naturaleza|roca espacial,meteorito|delapouite|
sunset|Atardecer|naturaleza||delapouite|
round-straw-bale|Bala de paja redonda|naturaleza|heno,granja|delapouite|
bamboo|Bambú|naturaleza|caña,planta|delapouite|
baobab|Baobab|naturaleza|árbol,sabana|delapouite|
acorn|Bellota|naturaleza|roble,fruto|lorc|
frozen-block|Bloque de hielo|naturaleza|helado,cubo|lorc|
tumbleweed|Bola rodadora|naturaleza|desierto|delapouite|
bonsai-tree|Bonsái|naturaleza|árbol,jardín|delapouite|
burning-forest|Bosque en llamas|naturaleza|incendio,árboles|delapouite|
burning-embers|Brasas|naturaleza|ascuas,fuego|lorc|
sprout|Brote|naturaleza|planta|lorc|
ground-sprout|Brote del suelo|naturaleza|planta,germinar|lorc|
sprout-disc|Brote en disco|naturaleza|planta|lorc|
new-shoot|Brote nuevo|naturaleza||lorc|
bulb|Bulbo|naturaleza|planta,cebolla|lorc|
bubbles|Burbujas|naturaleza|pompas,agua|lorc|
cactus|Cactus|naturaleza|planta,desierto|delapouite|
cactus-tap|Cactus con grifo|naturaleza|cactus,agua|delapouite|
cactus-pot|Cactus en maceta|naturaleza|cactus,maceta|delapouite|
food-chain|Cadena alimentaria|naturaleza|depredador,ecosistema|lorc|
caldera|Caldera|naturaleza|volcán,cráter|lorc|
heat-haze|Calima|naturaleza|calor,espejismo|lorc|
field|Campo|naturaleza|cultivo,prado|lorc|
cantua|Cantuta|naturaleza|flor,planta|delapouite|
reed|Caña|naturaleza|junco|delapouite|
hemp|Cáñamo|naturaleza|planta,fibra|delapouite|
bud|Capullo|naturaleza|capullo,planta|lorc|
sand-castle|Castillo de arena|naturaleza|playa|delapouite|
raining|Chaparrón|naturaleza|llover,tormenta|lorc|
splash-sbed|Chapoteo|naturaleza|agua|sbed|
splashy-stream|Chorro de agua|naturaleza|corriente|lorc|
circle-forest|Círculo de bosque|naturaleza|árboles|delapouite|
comet-spark|Cometa en el cielo|naturaleza|astro,estela|lorc|
flake|Copo|naturaleza|nieve,escama|sbed|
azul-flake|Copo azul|naturaleza|nieve,hielo|delapouite|
snowflake-2|Copo de nieve|naturaleza|hielo|lorc|
coral|Coral|naturaleza|mar,arrecife|delapouite|
mineral-heart|Corazón mineral|naturaleza||lorc|
crossed-air-flows|Corrientes de aire cruzadas|naturaleza|viento|lorc|
desert-skull|Cráneo del desierto|naturaleza|calavera,sequía|lorc|
growth|Crecimiento|naturaleza|planta,aumento|delapouite|
tree-growth|Crecimiento de árbol|naturaleza||delapouite|
wave-crest|Cresta de ola|naturaleza||lorc|
melting-ice-cube|Cubito derritiéndose|naturaleza|hielo|delapouite|
ice-cubes|Cubitos de hielo|naturaleza|hielo,escarcha|delapouite|
falling-rocks|Desprendimiento|naturaleza|rocas,derrumbe|delapouite|
eclipse-flare|Destello de eclipse|naturaleza|sol,luna|lorc|
dandelion-flower|Diente de león|naturaleza|flor|delapouite|
foamy-disc|Disco de espuma|naturaleza|espuma,burbujas|lorc|
eclipse|Eclipse|naturaleza|sol,luna|lorc|
spiky-eclipse|Eclipse espinoso|naturaleza|sol,luna|lorc|
ecology|Ecología|naturaleza|hoja,reciclaje|delapouite|
curling-vines|Enredadera|naturaleza|lianas|lorc|
thorny-vine|Enredadera espinosa|naturaleza||lorc|
vines|Enredaderas|naturaleza||delapouite|
eruption|Erupción|naturaleza|volcán|lorc|
foam|Espuma|naturaleza|burbujas,mar|lorc|
leaf-skeleton|Esqueleto de hoja|naturaleza||lorc|
stalactites|Estalactitas|naturaleza|cueva|delapouite|
stalagtite|Estalagmita|naturaleza|cueva|lorc|
falling-star|Estrella fugaz|naturaleza|meteoro,cielo|delapouite|
polar-star|Estrella polar|naturaleza|norte,astro|delapouite|
cotton-flower|Flor de algodón|naturaleza|planta|delapouite|
vine-flower|Flor de enredadera|naturaleza||lorc|
fire-flower|Flor de fuego|naturaleza|flor,llama|delapouite|
lotus-flower|Flor de loto|naturaleza||lorc|
vanilla-flower|Flor de vainilla|naturaleza||lorc|
spiral-bloom|Flor en espiral|naturaleza|florecer|lorc|
flower-star|Flor estrellada|naturaleza|flor,estrella|delapouite|
spoted-flower|Flor moteada|naturaleza|planta|lorc|
twirly-flower|Flor rizada|naturaleza||lorc|
fossil|Fósil|naturaleza|hueso,piedra|lorc|
fruiting|Fructificación|naturaleza|fruta,cosecha|lorc|
small-fire|Fuego pequeño|naturaleza|llama|lorc|
leak|Fuga|naturaleza|gota|delapouite|
galaxy|Galaxia|naturaleza|espacio,estrellas|delapouite|
sunflower|Girasol|naturaleza|flor|delapouite|
drop|Gota|naturaleza|agua|lorc|
water-drop|Gota de agua|naturaleza||sbed|
droplet-splash|Gota que salpica|naturaleza|agua,gota|lorc|
droplets|Gotas|naturaleza|agua|lorc|
grouped-drops|Gotas agrupadas|naturaleza|agua,lluvia|lorc|
earth-crack|Grieta en la tierra|naturaleza|terremoto|lorc|
beech|Haya|naturaleza|árbol|lorc|
fern|Helecho|naturaleza|planta|delapouite|
thorn-helix|Hélice de espinas|naturaleza||lorc|
grass|Hierba|naturaleza|césped,pasto|delapouite|
high-grass|Hierba alta|naturaleza|pasto,vegetación|delapouite|
celebration-fire|Hoguera de celebración|naturaleza|fuego,fiesta|lorc|
falling-leaf|Hoja cayendo|naturaleza|otoño,planta|lorc|
maple-leaf|Hoja de arce|naturaleza||lorc|
chestnut-leaf|Hoja de castaño|naturaleza|castaña|delapouite|
ginkgo-leaf|Hoja de ginkgo|naturaleza|planta,árbol|delapouite|
monstera-leaf|Hoja de monstera|naturaleza||delapouite|
oak-leaf|Hoja de roble|naturaleza||delapouite|
linden-leaf|Hoja de tilo|naturaleza||lorc|
flamed-leaf|Hoja en llamas|naturaleza|hoja,fuego|lorc|
zigzag-leaf|Hoja en zigzag|naturaleza||lorc|
curled-leaf|Hoja enroscada|naturaleza|planta|lorc|
solid-leaf|Hoja sólida|naturaleza|planta|delapouite|
iceberg|Iceberg|naturaleza|hielo,mar|delapouite|
icebergs|Icebergs|naturaleza|hielo,mar|lorc|
meteor-impact|Impacto de meteorito|naturaleza||lorc|
arson|Incendio provocado|naturaleza|fuego,llamas|lorc|
wildfires|Incendios forestales|naturaleza|fuego|lorc|
flood|Inundación|naturaleza|agua,riada|delapouite|
jasmine|Jazmín|naturaleza|flor,planta|delapouite|
jungle|Jungla|naturaleza|selva,vegetación|delapouite|
jupiter|Júpiter|naturaleza|planeta,astro|delapouite|
mushroom-gills|Láminas de seta|naturaleza||lorc|
lava|Lava|naturaleza|volcán|sbed|
flax|Lino|naturaleza|planta,fibra|delapouite|
trefoil-lily|Lirio de trébol|naturaleza|flor|lorc|
fluffy-flame|Llama esponjosa|naturaleza|fuego,llama|lorc|
lotus|Loto|naturaleza|flor|lorc|
dead-wood|Madera muerta|naturaleza|árbol,tronco|lorc|
herbs-bundle|Manojo de hierbas|naturaleza|plantas,alquimia|delapouite|
high-tide|Marea alta|naturaleza|mar,oleaje|delapouite|
low-tide|Marea baja|naturaleza||delapouite|
daisy|Margarita|naturaleza|flor|lorc|
butterfly-flower|Mariposa en flor|naturaleza|mariposa,flor|delapouite|
half-tornado|Medio tornado|naturaleza|viento,ciclón|lorc|
half-log|Medio tronco|naturaleza|madera,leña|delapouite|
menhir|Menhir|naturaleza|piedra|delapouite|
fragmented-meteor|Meteorito fragmentado|naturaleza|asteroide,roca|lorc|
ore|Mineral|naturaleza||faithtoken|
minerals|Minerales|naturaleza||faithtoken|
coal-pile|Montón de carbón|naturaleza|mineral|delapouite|
snowman|Muñeco de nieve|naturaleza|invierno|lorc|
lily-pads|Nenúfares|naturaleza||delapouite|
snowing|Nevando|naturaleza|nieve|lorc|
fog|Niebla|naturaleza|bruma,clima|delapouite|
nodular|Nodular|naturaleza||sbed|
dust-cloud|Nube de polvo|naturaleza|polvareda|lorc|
planet-core|Núcleo planetario|naturaleza||delapouite|
waves|Olas|naturaleza||lorc|
orbit|Órbita|naturaleza||skoll|
moon-orbit|Órbita lunar|naturaleza||delapouite|
ursa-major|Osa Mayor|naturaleza|constelación|delapouite|
palm-tree|Palmera|naturaleza||delapouite|
swamp|Pantano|naturaleza||delapouite|
dripping-stone|Piedra goteante|naturaleza|estalactita|lorc|
stone-stack|Pila de piedras|naturaleza||delapouite|
footsteps|Pisadas|naturaleza|huellas,rastro|skoll|
ringed-planet|Planeta con anillos|naturaleza|saturno|lorc|
carnivorous-plant|Planta carnívora|naturaleza|dionea|delapouite|
plants-and-animals|Plantas y animales|naturaleza||darkzaitzev|
seedling|Plántula|naturaleza|planta|delapouite|
pollen-dust|Polen|naturaleza|polvo,flor|lorc|
star-prominences|Protuberancias solares|naturaleza|sol|lorc|
root-tip|Punta de raíz|naturaleza|planta|lorc|
mushrooms-cluster|Racimo de setas|naturaleza||delapouite|
tree-roots|Raíces de árbol|naturaleza||delapouite|
plant-roots|Raíces de planta|naturaleza||delapouite|
windy-stripes|Rayas de viento|naturaleza||lorc|
cloudy-fork|Rayo entre nubes|naturaleza|tormenta,relámpago|lorc|
sunbeams|Rayos de luz|naturaleza||lorc|
sun-radiations|Rayos de sol|naturaleza||lorc|
chanterelles|Rebozuelos|naturaleza|setas,hongos|delapouite|
twister|Remolino|naturaleza||lorc|
flower-twirl|Remolino de flores|naturaleza|flores,pétalos|lorc|
leaf-swirl|Remolino de hojas|naturaleza||lorc|
fluffy-swirl|Remolino esponjoso|naturaleza|nube,viento|lorc|
plant-watering|Riego de plantas|naturaleza||delapouite|
crags|Riscos|naturaleza|peñascos,rocas|lorc|
holy-oak|Roble sagrado|naturaleza|árbol,druida|cathelineau|
rock|Roca|naturaleza|piedra|lorc|
falling-boulder|Roca cayendo|naturaleza|peña,derrumbe|lorc|
rock-john-redman|Roca con cara|naturaleza|piedra|john-redman|
dew|Rocío|naturaleza|gota,hoja|lorc|
shut-rose|Rosa cerrada|naturaleza|flor|lorc|
splash|Salpicadura|naturaleza|agua|lorc|
water-splash|Salpicadura de agua|naturaleza||lorc|
willow-tree|Sauce|naturaleza|árbol|caro-asercion|
elderberry|Saúco|naturaleza|baya,fruto|lorc|
plant-seed|Semilla|naturaleza||delapouite|
grass-mushroom|Seta de hierba|naturaleza|hongo,seta|delapouite|
trunk-mushroom|Seta de tronco|naturaleza||delapouite|
spotted-mushroom|Seta moteada|naturaleza|hongo|lorc|
mushrooms|Setas|naturaleza|hongos|delapouite|
silex|Sílex|naturaleza|pedernal|delapouite|
solar-system|Sistema solar|naturaleza|planetas|delapouite|
forward-sun|Sol naciente|naturaleza|amanecer,sol|faithtoken|
sun-cloud|Sol y nube|naturaleza|clima|delapouite|
super-mushroom|Superseta|naturaleza|seta|lorc|
logging|Tala|naturaleza|leñador|skoll|
beanstalk|Tallo de judía|naturaleza|planta,cuento|lorc|
cobweb|Telaraña rota|naturaleza|araña|lorc|
entangled-typhoon|Tifón enredado|naturaleza|tormenta|lorc|
stump-regrowth|Tocón que rebrota|naturaleza|árbol|delapouite|
sandstorm|Tormenta de arena|naturaleza|desierto|delapouite|
clover|Trébol|naturaleza|suerte,planta|lorc|
clover-sbed|Trébol de cuatro hojas|naturaleza|suerte|sbed|
shamrock|Trébol de tres hojas|naturaleza|irlanda|delapouite|
three-leaves|Tres hojas|naturaleza|trébol|lorc|
log|Tronco|naturaleza|madera|delapouite|
valley|Valle|naturaleza||lorc|
steam|Vapor|naturaleza||delapouite|
venus-flytrap|Venus atrapamoscas|naturaleza|planta|caro-asercion|
smoking-volcano|Volcán humeante|naturaleza|erupción|delapouite|
road|Camino|lugares|carretera|delapouite|*
graveyard|Cementerio|lugares|tumbas,camposanto|delapouite|*
direction-signs|Cruce de caminos|lugares|carteles,señales|delapouite|*
cave-entrance|Cueva|lugares|gruta,entrada|delapouite|*
crossroad|Encrucijada|lugares|cruce,caminos|delapouite|*
island|Isla|lugares|islote,mar|delapouite|*
dungeon-gate|Mazmorra|lugares|reja,portón|delapouite|*
mountain-cave|Montaña|lugares|cueva|delapouite|*
mountains|Montañas|lugares||lorc|*
world|Mundo|lugares|planeta|lorc|*
bridge|Puente|lugares|cruce,río|lorc|*
harbor-dock|Puerto|lugares|muelle,embarcadero|delapouite|*
river|Río|lugares|corriente|delapouite|*
journey|Viaje|lugares|camino,aventura|lorc|*
sea-cliff|Acantilado|lugares|costa|delapouite|
africa|África|lugares|continente,mapa|delapouite|
hole|Agujero|lugares|hoyo,cavidad|delapouite|
huts-village|Aldea de chozas|lugares|poblado,cabañas|delapouite|
antarctica|Antártida|lugares|polo,hielo|delapouite|
australia|Australia|lugares|continente,mapa|delapouite|
path-tile|Baldosa de camino|lugares||delapouite|
horizon-road|Camino al horizonte|lugares|carretera,sendero|delapouite|
mountain-road|Camino de montaña|lugares||delapouite|
stone-path|Camino de piedra|lugares|sendero|delapouite|
desert-camp|Campamento del desierto|lugares|tienda,oasis|delapouite|
forest-camp|Campamento en el bosque|lugares|acampada,tienda|delapouite|
goblin-camp|Campamento goblin|lugares|trasgo,tiendas|delapouite|
minefield|Campo de minas|lugares||skoll|
mountaintop|Cima de montaña|lugares||lorc|
modern-city|Ciudad moderna|lugares||delapouite|
hills|Colinas|lugares|montes,paisaje|delapouite|
colombia|Colombia|lugares|país,mapa|delapouite|
hill-conquest|Conquista de la colina|lugares|cima,bandera|delapouite|
corsica|Córcega|lugares|isla,mapa|delapouite|
cliff-crossing|Cruce de acantilado|lugares|precipicio,barranco|delapouite|
underground-cave|Cueva subterránea|lugares||delapouite|
mid-summit|Cumbre media|lugares|montaña|delapouite|
summits|Cumbres|lugares|montañas|delapouite|
dolmen|Dolmen|lugares|megalito,piedras|delapouite|
egypt|Egipto|lugares|país,mapa|delapouite|
wooden-pier|Embarcadero|lugares|muelle|delapouite|
at-sea|En el mar|lugares|barco,océano|lorc|
crypt-entrance|Entrada a la cripta|lugares|tumba,mazmorra|delapouite|
shiny-entrance|Entrada brillante|lugares|puerta|lorc|
forest-entrance|Entrada del bosque|lugares|camino,árboles|delapouite|
mountain-climbing|Escalada|lugares|montaña|caro-asercion|
hole-ladder|Escalera al agujero|lugares|sótano,pozo|delapouite|
sverd-i-fjell|Espadas en la roca|lugares|monumento|delapouite|
globe-ring|Globo con anillo|lugares|mundo,planeta|delapouite|
globe|Globo terráqueo|lugares|mundo,planeta|lorc|
iceland|Islandia|lugares|isla,país|delapouite|
wavy-itinerary|Itinerario ondulante|lugares|ruta|lorc|
maze|Laberinto|lugares||lorc|
black-sea|Mar Negro|lugares|mar,océano|delapouite|
gold-mine|Mina de oro|lugares|minería,oro|delapouite|
fuji|Monte Fuji|lugares|montaña,japón|delapouite|
monument-valley|Monument Valley|lugares|desierto|delapouite|
oasis|Oasis|lugares|desierto|delapouite|
peaks|Picos|lugares|montañas|lorc|
floating-platforms|Plataformas flotantes|lugares|islas,aire|delapouite|
tall-bridge|Puente alto|lugares||delapouite|
cable-stayed-bridge|Puente atirantado|lugares|puente,cables|delapouite|
suspension-bridge|Puente colgante|lugares||delapouite|
arch-bridge|Puente de arco|lugares|puente,arco|delapouite|
rope-bridge|Puente de cuerda|lugares|colgante|delapouite|
stone-bridge|Puente de piedra|lugares||delapouite|
rialto-bridge|Puente de Rialto|lugares|venecia|delapouite|
japanese-bridge|Puente japonés|lugares|puente,arco|delapouite|
black-bridge|Puente negro|lugares|puente,cruce|delapouite|
trail|Sendero|lugares||delapouite|
south-america|Sudamérica|lugares|continente|delapouite|
earth-africa-europe|Tierra: África y Europa|lugares|planeta,mapa|delapouite|
earth-america|Tierra: América|lugares|planeta,mapa|delapouite|
earth-asia-oceania|Tierra: Asia y Oceanía|lugares|planeta,mapa|delapouite|
uluru|Uluru|lugares|monte|delapouite|
village|Aldea|edificios|pueblo|delapouite|*
watchtower|Atalaya|edificios||delapouite|*
house|Casa|edificios|hogar,vivienda|delapouite|*
castle|Castillo|edificios|fortaleza|lorc|*
lighthouse|Faro|edificios||delapouite|*
fountain|Fuente|edificios|agua,plaza|lorc|*
windmill|Molino|edificios||delapouite|*
obelisk|Obelisco|edificios||delapouite|*
egyptian-pyramids|Pirámides|edificios|egipto|delapouite|*
well|Pozo|edificios||delapouite|*
wooden-door|Puerta|edificios|madera|lorc|*
locked-door|Puerta cerrada|edificios||delapouite|*
castle-ruins|Ruinas|edificios|castillo,derruido|delapouite|*
ancient-ruins|Ruinas antiguas|edificios|ruinas,columnas|delapouite|*
greek-temple|Santuario|edificios|templo,columnas|delapouite|*
tavern-sign|Taberna|edificios|cartel|delapouite|*
church|Templo|edificios|iglesia|delapouite|*
tower-flag|Torre|edificios|bandera|delapouite|*
white-tower|Torre blanca|edificios||lorc|*
stone-tower|Torre de piedra|edificios||lorc|*
aqueduct|Acueducto|edificios|romano,agua|delapouite|
medieval-village-01|Aldea medieval|edificios|pueblo|caro-asercion|
warehouse|Almacén|edificios||delapouite|
arc-triomphe|Arco del Triunfo|edificios|monumento,parís|delapouite|
arena|Arena|edificios|coliseo,circo|sbed|
bank|Banco|edificios|finanzas,dinero|delapouite|
barricade|Barricada|edificios|bloqueo,defensa|delapouite|
bunker|Búnker|edificios|refugio,fortificación|quoting|
hut|Cabaña|edificios|choza,casa|delapouite|
wood-cabin|Cabaña de madera|edificios||delapouite|
tower-fall|Caída de la torre|edificios||lorc|
capitol|Capitolio|edificios|congreso,parlamento|lorc|
viking-longhouse|Casa comunal vikinga|edificios||delapouite|
damaged-house|Casa dañada|edificios|ruinas|quoting|
mushroom-house|Casa de setas|edificios||delapouite|
treehouse|Casa del árbol|edificios||caro-asercion|
spooky-house|Casa embrujada|edificios|encantada|delapouite|
dog-house|Caseta de perro|edificios|perrera|delapouite|
castle-delapouite|Castillo con almenas|edificios|fortaleza|delapouite|
elven-castle|Castillo élfico|edificios|elfos,fortaleza|pepijn-poolman|
saint-basil-cathedral|Catedral de San Basilio|edificios|moscú|delapouite|
nuclear-plant|Central nuclear|edificios||delapouite|
chimney|Chimenea de tejado|edificios|humo|delapouite|
qaitbay-citadel|Ciudadela de Qaitbay|edificios|fortaleza,faro|delapouite|
coliseum|Coliseo|edificios|anfiteatro,arena|delapouite|
ionic-column|Columna jónica|edificios|columna,griega|delapouite|
ancient-columns|Columnas antiguas|edificios|ruinas,pilares|delapouite|
barracks|Cuartel|edificios|barracón,militar|delapouite|
medieval-barracks|Cuartel medieval|edificios||delapouite|
base-dome|Cúpula base|edificios|domo,cúpula|delapouite|
palisade|Empalizada|edificios|muro|delapouite|
stairs|Escaleras|edificios|peldaños|delapouite|
stable|Establo|edificios|caballos|delapouite|
factory|Fábrica|edificios|industria|delapouite|
locked-fortress|Fortaleza cerrada|edificios||lorc|
block-house|Fortín|edificios|blocao,fuerte|delapouite|
hill-fort|Fuerte en la colina|edificios|fortificación,castro|delapouite|
military-fort|Fuerte militar|edificios||delapouite|
home-garage|Garaje|edificios|coche,casa|delapouite|
great-pyramid|Gran pirámide|edificios|egipto,keops|delapouite|
barn|Granero|edificios|establo,granja|delapouite|
hospital|Hospital|edificios|sanatorio,clínica|delapouite|
viking-church|Iglesia vikinga|edificios||delapouite|
igloo|Iglú|edificios|hielo,casa|delapouite|
greenhouse|Invernadero|edificios|cultivo,plantas|delapouite|
samara-mosque|Mezquita de Samarra|edificios|minarete|delapouite|
water-mill|Molino de agua|edificios||caro-asercion|
hobbit-dwelling|Morada de hobbit|edificios|casa,agujero|delapouite|
rempart|Muralla|edificios|baluarte|delapouite|
brick-wall|Muro de ladrillos|edificios|pared,ladrillo|delapouite|
stone-wall|Muro de piedra|edificios|muralla|delapouite|
spiked-wall|Muro de pinchos|edificios|trampa|delapouite|
defensive-wall|Muro defensivo|edificios|muralla|heavenly-dog|
broken-wall|Muro roto|edificios|pared,derruido|delapouite|
observatory|Observatorio|edificios||delapouite|
post-office|Oficina de correos|edificios|correo|delapouite|
sydney-opera-house|Ópera de Sídney|edificios||delapouite|
oppidum|Oppidum|edificios|fortaleza|cathelineau|
medieval-pavilion|Pabellón medieval|edificios|tienda|delapouite|
pagoda|Pagoda|edificios|templo|delapouite|
indian-palace|Palacio indio|edificios|palacio,taj mahal|delapouite|
louvre-pyramid|Pirámide del Louvre|edificios||delapouite|
mayan-pyramid|Pirámide maya|edificios||delapouite|
offshore-platform|Plataforma petrolífera|edificios||delapouite|
temple-gate|Pórtico de templo|edificios||delapouite|
dam|Presa|edificios|embalse|delapouite|
tower-bridge|Puente de la Torre|edificios|londres|delapouite|
drawbridge|Puente levadizo|edificios|castillo|delapouite|
open-gate|Puerta abierta|edificios||delapouite|
arabic-door|Puerta árabe|edificios|puerta,arco|delapouite|
steel-door|Puerta de acero|edificios||skoll|
entry-door|Puerta de entrada|edificios|portal|delapouite|
hobbit-door|Puerta de hobbit|edificios|puerta redonda,casa|delapouite|
india-gate|Puerta de la India|edificios|arco,monumento|delapouite|
ranch-gate|Puerta de rancho|edificios|valla,granja|delapouite|
exit-door|Puerta de salida|edificios|salir,huida|delapouite|
security-gate|Puerta de seguridad|edificios|verja|delapouite|
temple-door|Puerta de templo|edificios||delapouite|
tree-door|Puerta en un árbol|edificios||delapouite|
medieval-gate|Puerta medieval|edificios||delapouite|
secret-door|Puerta secreta|edificios|pasadizo|delapouite|
door|Puerta sencilla|edificios|entrada|delapouite|
closed-doors|Puertas cerradas|edificios|portón|delapouite|
saloon-doors|Puertas de saloon|edificios|oeste|delapouite|
portculis|Rastrillo de castillo|edificios|puerta,castillo,verja|lorc|
fallout-shelter|Refugio antiatómico|edificios|búnker,refugio|delapouite|
saloon|Saloon|edificios|taberna,oeste|delapouite|
slumbering-sanctuary|Santuario dormido|edificios|templo|delapouite|
shinto-shrine|Santuario sintoísta|edificios|templo,torii|delapouite|
granary|Silo de grano|edificios|silo,cosecha|delapouite|
round-silo|Silo redondo|edificios|granero|delapouite|
space-needle|Space Needle|edificios|torre|delapouite|
mechanic-garage|Taller mecánico|edificios||delapouite|
byzantin-temple|Templo bizantino|edificios|iglesia,cúpula|delapouite|
egyptian-temple|Templo egipcio|edificios|egipto|delapouite|
shop|Tienda|edificios|comercio|delapouite|
barracks-tent|Tienda de cuartel|edificios|tienda,campamento|delapouite|
tipi|Tipi|edificios|tienda|delapouite|
water-tower|Torre de agua|edificios||delapouite|
control-tower|Torre de control|edificios|aeropuerto|delapouite|
pisa-tower|Torre de Pisa|edificios||delapouite|
tv-tower|Torre de televisión|edificios||delapouite|
heart-tower|Torre del corazón|edificios|amor,torre|lorc|
clock-tower|Torre del reloj|edificios|campanario|caro-asercion|
evil-tower|Torre maligna|edificios|torre oscura|delapouite|
oil-rig|Torre petrolífera|edificios||delapouite|
guarded-tower|Torre vigilada|edificios|guardia,atalaya|lorc|
floor-hatch|Trampilla|edificios|suelo,entrada|delapouite|
triple-gate|Triple puerta|edificios||delapouite|
doorway|Umbral|edificios|umbral,entrada|lorc|
spiked-fence|Valla de pinchos|edificios|empalizada|lorc|
window|Ventana|edificios||delapouite|
window-bars|Ventana con barrotes|edificios||delapouite|
gate|Verja|edificios|verja,entrada|delapouite|
pocket-bow|Arco|armas|ballesta|lorc|*
crossbow|Ballesta|armas|arco|carl-olsen|*
unlit-bomb|Bomba|armas||lorc|*
cannon|Cañón|armas|artillería|lorc|*
letter-bomb|Carta|armas|carta bomba|lorc|*
catapult|Catapulta|armas|asedio|heavenly-dog|*
curvy-knife|Cuchillo|armas|daga,curvo|lorc|*
plain-dagger|Daga|armas||lorc|*
broadsword|Espada|armas|espada ancha,mandoble|lorc|*
bloody-sword|Espada ensangrentada|armas|espada,sangre|lorc|*
crossed-swords|Espadas cruzadas|armas|combate|lorc|*
high-shot|Flecha|armas|proyectil,disparo|lorc|*
arrow-cluster|Flechas|armas|haz de flechas,munición|lorc|*
scythe|Guadaña|armas|hoz|lorc|*
battle-axe|Hacha|armas|hacha de batalla,hacha de guerra|lorc|*
war-axe|Hacha de guerra|armas||delapouite|*
slingshot|Honda|armas|tirachinas|delapouite|*
katana|Katana|armas|espada,japonés|delapouite|*
barbed-spear|Lanza|armas|lanza con púas,pica|lorc|*
flail|Mangual|armas|maza,cadena|delapouite|*
warhammer|Martillo de guerra|armas||delapouite|*
mace-head|Maza|armas|cabeza|lorc|*
mortar|Mortero|armas||delapouite|*
war-pick|Pico|armas||delapouite|*
trebuchet|Trebuchet|armas|catapulta|delapouite|*
trident|Tridente|armas||lorc|*
caltrops|Abrojos|armas|trampa,púas|delapouite|
ak47|AK-47|armas|fusil,rifle|skoll|
ak47u|AK-47U|armas|fusil,subfusil|skoll|
halberd|Alabarda|armas|arma de asta,hacha|lorc|
sharp-halberd|Alabarda afilada|armas|asta|delapouite|
halberd-shuriken|Alabarda y shuriken|armas|arma de asta,ninja|lorc|
machine-gun|Ametralladora|armas||skoll|
chaingun|Ametralladora giratoria|armas|minigun|sbed|
lightning-bow|Arco de rayos|armas||lorc|
bow-arrow|Arco y flecha|armas|arco,flechas|delapouite|
siege-ram|Ariete|armas|asedio|skoll|
autogun|Arma automática|armas|ametralladora,pistola|lorc|
aerodynamic-harpoon|Arpón aerodinámico|armas|lanza|lorc|
harpoon-chain|Arpón con cadena|armas|pesca,ballena|lorc|
harpoon-trident|Arpón de tridente|armas|pesca,tridente|lorc|
cannon-ball|Bala de cañón|armas|proyectil,munición|lorc|
burning-round-shot|Bala de cañón ardiente|armas|proyectil,fuego|lorc|
silver-bullet|Bala de plata|armas|munición|delapouite|
supersonic-bullet|Bala supersónica|armas||lorc|
bullets|Balas|armas|munición,proyectiles|lorc|
heavy-bullets|Balas pesadas|armas|munición,proyectiles|delapouite|
ballista|Balista|armas|ballesta gigante,artillería|skoll|
crescent-staff|Bastón lunar|armas|báculo,creciente|delapouite|
bat-leth|Bat'leth|armas|espada,klingon|delapouite|
spiked-bat|Bate con pinchos|armas|clava|skoll|
baseball-bat|Bate de béisbol|armas|bate,deporte|delapouite|
bayonet|Bayoneta|armas|cuchillo,fusil|skoll|
blaster|Blaster|armas|pistola láser,ciencia ficción|sbed|
bo|Bo|armas|bastón,artes marciales|delapouite|
spiked-ball|Bola con pinchos|armas|maza|skoll|
spikeball|Bola de pinchos|armas|maza|sbed|
bolas|Boleadoras|armas|bolas,lazo|lorc|
black-hole-bolas|Boleadoras de agujero negro|armas|bolas,espacio|lorc|
hunting-bolas|Boleadoras de caza|armas|lazo,caza|delapouite|
bolter-gun|Bólter|armas|arma de fuego,ciencia ficción|lorc|
falling-bomb|Bomba cayendo|armas|bombardeo,explosivo|delapouite|
sparky-bomb|Bomba chispeante|armas|explosivo|lorc|
ice-bomb|Bomba de hielo|armas|explosivo,escarcha|lorc|
smoke-bomb|Bomba de humo|armas|ninja|darkzaitzev|
paper-bomb|Bomba de papel|armas||lorc|
cluster-bomb|Bomba de racimo|armas|explosivo|lorc|
time-bomb|Bomba de relojería|armas||lorc|
fire-bomb|Bomba incendiaria|armas|explosivo,fuego|lorc|
inferno-bomb|Bomba infernal|armas|explosivo,fuego|delapouite|
nuclear-bomb|Bomba nuclear|armas||skoll|
rolling-bomb|Bomba rodante|armas|explosivo|lorc|
carpet-bombing|Bombardeo en alfombra|armas|bombas,aviones|skoll|
cannister|Bote de metralla|armas|munición,cañón|lorc|
fire-bottle|Botella incendiaria|armas|botella,incendiaria|lorc|
boomerang|Bumerán|armas|boomerang|delapouite|
armored-boomerang|Bumerán acorazado|armas|bumerán|delapouite|
boomerang-cross|Bumerán en cruz|armas|boomerang,cruz|delapouite|
boomerang-sun|Bumerán solar|armas|boomerang,sol|lorc|
c96|C96|armas|pistola,mauser|skoll|
ammo-box|Caja de munición|armas|cartuchos,balas|sbed|
anti-aircraft-gun|Cañón antiaéreo|armas|artillería|pierre-leducq|
field-gun|Cañón de campaña|armas|artillería,cañón|quoting|
lucifer-cannon|Cañón Lucifer|armas||sbed|
pirate-cannon|Cañón pirata|armas||delapouite|
cloak-dagger|Capa y daga|armas|sigilo,pícaro|lorc|
quiver|Carcaj|armas|flechas|delapouite|
machine-gun-magazine|Cargador de ametralladora|armas|munición|delapouite|
shotgun-rounds|Cartuchos de escopeta|armas|munición|delapouite|
chakram|Chakram|armas|disco,aro|delapouite|
molotov|Cóctel molotov|armas||lorc|
incoming-rocket|Cohete entrante|armas|misil,proyectil|lorc|
missile-pod|Contenedor de misiles|armas||lorc|
cleaver|Cuchilla de carnicero|armas|machete,cocina|delapouite|
spinning-blades|Cuchillas giratorias|armas|aspas|lorc|
bowie-knife|Cuchillo Bowie|armas|cuchillo,daga|lorc|
bowie-knife-skoll|Cuchillo Bowie (alt.)|armas|cuchillo,daga|skoll|
meat-cleaver|Cuchillo de carnicero|armas||lorc|
bone-knife|Cuchillo de hueso|armas|cuchillo,daga|lorc|
bone-knife-delapouite|Cuchillo de hueso (alt.)|armas|cuchillo,daga|delapouite|
trench-knife|Cuchillo de trinchera|armas||skoll|
dripping-knife|Cuchillo sangrante|armas|sangre|lorc|
bow-string|Cuerda de arco|armas|arco,cuerda|delapouite|
gun-stock|Culata|armas|fusil,empuñadura|delapouite|
box-cutter|Cúter|armas|cuchilla,navaja|delapouite|
broad-dagger|Daga ancha|armas|puñal,cuchillo|lorc|
diving-dagger|Daga de buceo|armas|cuchillo,submarinismo|lorc|
sacrificial-dagger|Daga sacrificial|armas|ritual|lorc|
flying-dagger|Daga voladora|armas|puñal,arrojadiza|lorc|
dagger-rose|Daga y rosa|armas|flor,romance|delapouite|
daggers|Dagas|armas|puñales|lorc|
dart|Dardo|armas|proyectil|delapouite|
rope-dart|Dardo de cuerda|armas|cadena|delapouite|
smoking-finger|Dedo humeante|armas|disparo|lorc|
detonator|Detonador|armas|explosivo|delapouite|
target-arrows|Diana con flechas|armas||lorc|
dynamite|Dinamita|armas|explosivo|delapouite|
time-dynamite|Dinamita con reloj|armas||delapouite|
circular-sawblade|Disco de sierra|armas|hoja,cuchilla|lorc|
diamond-hilt|Empuñadura de diamante|armas|espada,gema|delapouite|
sword-hilt|Empuñadura de espada|armas|espada|lorc|
spiral-hilt|Empuñadura en espiral|armas|espada|delapouite|
missile-swarm|Enjambre de misiles|armas||lorc|
shotgun|Escopeta|armas|arma de fuego|sbed|
sawed-off-shotgun|Escopeta recortada|armas|arma de fuego|delapouite|
winged-sword|Espada alada|armas||lorc|
ancient-sword|Espada antigua|armas|espada|delapouite|
sword-tie|Espada atada|armas||lorc|
shining-sword|Espada brillante|armas|mágica|lorc|
croc-sword|Espada de cocodrilo|armas|dientes,aserrada|lorc|
energy-sword|Espada de energía|armas|sable láser|lorc|
shard-sword|Espada de fragmentos|armas|cristal|lorc|
zeus-sword|Espada de Zeus|armas|rayo|lorc|
thunder-blade|Espada del trueno|armas||lorc|
sword-in-stone|Espada en la piedra|armas|excalibur|lorc|
fragmented-sword|Espada fragmentada|armas|espada rota,trozos|lorc|
rusty-sword|Espada oxidada|armas|vieja|delapouite|
piercing-sword|Espada perforante|armas||lorc|
pointy-sword|Espada puntiaguda|armas|estoque|lorc|
striped-sword|Espada rayada|armas||lorc|
bouncing-sword|Espada rebotando|armas|espada,rebote|lorc|
shattered-sword|Espada rota|armas|quebrada|lorc|
rune-sword|Espada rúnica|armas|mágica|lorc|
dripping-sword|Espada sangrante|armas|sangre|lorc|
gooey-sword|Espada viscosa|armas|baba,espada|lorc|
sword-spade|Espada y pala|armas||lorc|
dervish-swords|Espadas de derviche|armas|sables|lorc|
hook-swords|Espadas ganchudas|armas|espadas,gancho|delapouite|
two-handed-sword|Espadón|armas|mandoble|delapouite|
heart-stake|Estaca en el corazón|armas|vampiro,estaca|delapouite|
stake-hammer|Estaca y martillo|armas|vampiros|delapouite|
stiletto|Estilete|armas|daga|lorc|
stiletto-skoll|Estilete curvo|armas|daga|skoll|
ninja-star|Estrella ninja|armas|shuriken|faithtoken|
famas|Famas|armas|fusil,rifle|skoll|
crosshair-arrow|Flecha a la mira|armas|objetivo|lorc|
winged-arrow|Flecha alada|armas||lorc|
wide-arrow-dunk|Flecha ancha clavada|armas||lorc|
charged-arrow|Flecha cargada|armas|energía|lorc|
thorned-arrow|Flecha con espinas|armas||lorc|
barbed-arrow|Flecha con púas|armas|flecha,munición|lorc|
frozen-arrow|Flecha congelada|armas|hielo,flecha|lorc|
cupidon-arrow|Flecha de cupido|armas|amor|lorc|
energy-arrow|Flecha de energía|armas|magia|lorc|
spine-arrow|Flecha de espina|armas|dardo|lorc|
broadhead-arrow|Flecha de punta ancha|armas|flecha,caza|lorc|
branch-arrow|Flecha de rama|armas|flecha,rama|lorc|
frayed-arrow|Flecha deshilachada|armas|flecha,gastada|lorc|
flaming-arrow|Flecha en llamas|armas|fuego,flecha incendiaria|lorc|
lob-arrow|Flecha en parábola|armas||lorc|
zig-arrow|Flecha en zigzag|armas||lorc|
heavy-arrow|Flecha pesada|armas|proyectil,saeta|lorc|
chemical-arrow|Flecha química|armas|veneno,ácido|lorc|
fast-arrow|Flecha rápida|armas|saeta,proyectil|lorc|
broken-arrow|Flecha rota|armas|flecha,fallo|catsu|
plain-arrow|Flecha simple|armas||delapouite|
supersonic-arrow|Flecha supersónica|armas||lorc|
striking-arrows|Flechas al blanco|armas||lorc|
chained-arrow-heads|Flechas encadenadas|armas|puntas,cadena|lorc|
fn-fal|FN FAL|armas|fusil,rifle|skoll|
lee-enfield|Fusil Lee-Enfield|armas|rifle|skoll|
steyr-aug|Fusil Steyr AUG|armas||skoll|
pirate-hook|Garfio pirata|armas||delapouite|
saw-claw|Garra de sierra|armas|hoja dentada|lorc|
steel-claws|Garras de acero|armas||lorc|
steel-claws-skoll|Garras de acero afiladas|armas||skoll|
wolverine-claws|Garras de glotón|armas||lorc|
wolverine-claws-delapouite|Garras de Lobezno|armas||delapouite|
gladius|Gladio|armas|espada,romana|skoll|
glock|Glock|armas|pistola,arma de fuego|skoll|
grenade|Granada|armas|explosivo,bomba|lorc|
stun-grenade|Granada aturdidora|armas||delapouite|
flash-grenade|Granada de destello|armas|explosivo,destello|lorc|
stick-grenade|Granada de mango|armas||skoll|
grenade-sbed|Granada de mano|armas|explosivo,bomba|sbed|
holy-hand-grenade|Granada santa|armas|explosivo,sagrada|delapouite|
edge-crack|Grieta en el filo|armas|rotura|lorc|
reaper-scythe|Guadaña de segador|armas|muerte|lorc|
glaive|Guja|armas|arma de asta,lanza|delapouite|
sharp-axe|Hacha afilada|armas|hacha|delapouite|
fire-axe|Hacha de bombero|armas|hacha,incendio|lorc|
stone-axe|Hacha de piedra|armas||lorc|
axe-sword|Hacha espada|armas|hacha,espada|delapouite|
battered-axe|Hacha mellada|armas|hacha,vieja|lorc|
broken-axe|Hacha rota|armas|hacha,estropeada|delapouite|
crossed-axes|Hachas cruzadas|armas|hacha|lorc|
hatchet|Hachuela|armas|hacha,herramienta|delapouite|
hatchets|Hachuelas|armas|hachas,herramientas|lorc|
bundle-grenade|Haz de granadas|armas|granadas,explosivo|skoll|
sword-array|Hilera de espadas|armas||lorc|
crescent-blade|Hoja creciente|armas|luna,cuchilla|lorc|
crescent-blade-skoll|Hoja de luna|armas|creciente,cuchilla|skoll|
bat-blade|Hoja de murciélago|armas|batarang,cuchilla|lorc|
dripping-blade|Hoja goteante|armas|sangre,espada|lorc|
relic-blade|Hoja reliquia|armas|espada,antigua|lorc|
sling|Honda de pastor|armas|tirachinas|delapouite|
pitchfork|Horca de labranza|armas||delapouite|
sickle|Hoz|armas|segar|delapouite|
kusarigama|Kusarigama|armas|cadena,hoz|darkzaitzev|
spear-hook|Lanza con gancho|armas|garfio|lorc|
spear-feather|Lanza con plumas|armas|jabalina|delapouite|
stone-spear|Lanza de piedra|armas||lorc|
sun-spear|Lanza solar|armas||delapouite|
flamethrower|Lanzallamas|armas|fuego,incendiario|delapouite|
flamer|Lanzallamas pesado|armas|fuego,incendiario|sbed|
missile-launcher|Lanzamisiles|armas||delapouite|
spears|Lanzas|armas|picas|lorc|
whip|Látigo|armas||lorc|
electric-whip|Látigo eléctrico|armas|descarga|lorc|
machete|Machete|armas||lorc|
3d-hammer|Martillo 3D|armas|maza|delapouite|
thor-hammer|Martillo de Thor|armas||delapouite|
explosive-materials|Materiales explosivos|armas|dinamita,pólvora|lorc|
spiked-mace|Maza con pinchos|armas|porra|lorc|
flanged-mace|Maza de cabeza con rebordes|armas|maza,porra|delapouite|
bone-mace|Maza de hueso|armas|maza,garrote|delapouite|
wood-club|Maza de madera|armas|garrote|delapouite|
teller-mine|Mina antitanque|armas||skoll|
claymore-explosive|Mina claymore|armas|explosivo|delapouite|
land-mine|Mina terrestre|armas|explosivo|lorc|
minigun|Minigun|armas||lorc|
submarine-missile|Misil submarino|armas||delapouite|
musket|Mosquete|armas||skoll|
chainsaw|Motosierra|armas|sierra|delapouite|
switchblade|Navaja automática|armas||skoll|
butterfly-knife|Navaja mariposa|armas|cuchillo,balisong|delapouite|
butterfly-knife-skoll|Navaja mariposa (alt.)|armas|cuchillo,balisong|skoll|
nunchaku|Nunchaku|armas||delapouite|
trench-spade|Pala de trinchera|armas||skoll|
panzerfaust|Panzerfaust|armas||delapouite|
umbrella-bayonet|Paraguas bayoneta|armas||delapouite|
spearfishing|Pesca con arpón|armas|arpón|delapouite|
squib|Petardo|armas|explosivo|lorc|
pistol-gun|Pistola|armas||john-colburn|
desert-eagle|Pistola Desert Eagle|armas|arma de fuego|skoll|
laser-gun|Pistola láser|armas||sbed|
luger|Pistola Luger|armas||skoll|
colt-m1911|Pistola M1911|armas|arma de fuego|skoll|
tec-9|Pistola Tec-9|armas||skoll|
walther-ppk|Pistola Walther PPK|armas||skoll|
zat-gun|Pistola Zat|armas||delapouite|
crossed-pistols|Pistolas cruzadas|armas|armas de fuego|lorc|
arrow-flights|Plumas de flecha|armas|empenaje,flecha|lorc|
baton|Porra|armas|cachiporra,bastón|skoll|
telescopic-baton|Porra extensible|armas||skoll|
artillery-shell|Proyectil de artillería|armas|obús,munición|quoting|
arrowhead|Punta de flecha|armas|flecha,puntas|lorc|
spotted-arrowhead|Punta de flecha moteada|armas|flecha|lorc|
brass-knuckles|Puño americano|armas|nudillos,manopla|delapouite|
thor-fist|Puño de Thor|armas||lorc|
reload-gun-barrel|Recargar arma|armas|cañón|delapouite|
revolver|Revólver|armas|pistola|delapouite|
revolver-skoll|Revólver antiguo|armas|pistola|skoll|
rifle|Rifle|armas|fusil|sbed|
winchester-rifle|Rifle Winchester|armas||skoll|
sparkling-sabre|Sable brillante|armas|mágico|lorc|
lightning-saber|Sable de rayos|armas||lorc|
cracked-saber|Sable roto|armas|espada|lorc|
saber-and-pistol|Sable y pistola|armas|pirata|delapouite|
crossed-sabres|Sables cruzados|armas|espadas|lorc|
light-sabers|Sables de luz|armas||delapouite|
powder-bag|Saco de pólvora|armas|explosivo|delapouite|
sai|Sai|armas|japonés|delapouite|
shuriken|Shuriken|armas|ninja|lorc|
sharp-shuriken|Shuriken afilado|armas|ninja|darkzaitzev|
shuriken-aperture|Shuriken con apertura|armas|ninja|lorc|
star-shuriken|Shuriken de estrella|armas|ninja|darkzaitzev|
north-star-shuriken|Shuriken de la estrella polar|armas||darkzaitzev|
trefoil-shuriken|Shuriken de trébol|armas||lorc|
three-pointed-shuriken|Shuriken de tres puntas|armas||darkzaitzev|
shuriken-darkzaitzev|Shuriken oscuro|armas|ninja|darkzaitzev|
whirlpool-shuriken|Shuriken remolino|armas||darkzaitzev|
flying-shuriken|Shuriken volador|armas|ninja,estrella|darkzaitzev|
eclipse-saw|Sierra de eclipse|armas|sierra,luna|lorc|
maze-saw|Sierra del laberinto|armas||lorc|
spectre-m4|Subfusil|armas|arma de fuego|skoll|
automatic-sas|Subfusil automático|armas|subfusil,escopeta|lorc|
m3-grease-gun|Subfusil M3|armas||skoll|
mac-10|Subfusil MAC-10|armas||skoll|
mp-40|Subfusil MP40|armas||skoll|
mp5|Subfusil MP5|armas||delapouite|
mp5-skoll|Subfusil MP5 Skoll|armas||skoll|
mp5k|Subfusil MP5K|armas||skoll|
p90|Subfusil P90|armas||skoll|
cz-skorpion|Subfusil Skorpion|armas|arma de fuego|skoll|
thompson-m1|Subfusil Thompson M1|armas||skoll|
thompson-m1928|Subfusil Thompson M1928|armas||skoll|
tomahawk|Tomahawk|armas|hacha|delapouite|
torpedo|Torpedo|armas||delapouite|
siege-tower|Torre de asedio|armas|asedio|delapouite|
turret|Torreta|armas||sbed|
sentry-gun|Torreta automática|armas|centinela|lorc|
blunderbuss|Trabuco|armas|arma de fuego,escopeta|lorc|
flaming-trident|Tridente en llamas|armas|fuego,tridente|lorc|
evil-fork|Tridente maligno|armas|horca|lorc|
lead-pipe|Tubería de plomo|armas|barra|delapouite|
uzi|Uzi|armas||delapouite|
scabbard|Vaina|armas|funda|delapouite|
hypersonic-bolt|Virote hipersónico|armas|rayo,proyectil|lorc|
chemical-bolt|Virote químico|armas|veneno,ácido|lorc|
ring|Anillo|armaduras|sortija|delapouite|*
diamond-ring|Anillo con gema|armaduras|joya,sortija|delapouite|*
domino-mask|Antifaz|armaduras|máscara,ladrón|lorc|*
leather-armor|Armadura de cuero|armaduras||delapouite|*
hand-bag|Bolso|armaduras|bolsa,complemento|delapouite|*
boots|Botas|armaduras|calzado|lorc|*
jester-hat|Bufón|armaduras|gorro,payaso|delapouite|*
hood|Capucha|armaduras|capa,prenda|lorc|*
gem-pendant|Colgante|armaduras|joya,collar|lorc|*
star-medal|Condecoración|armaduras|medalla|delapouite|*
breastplate|Coraza|armaduras|peto,pectoral|lorc|*
crown|Corona|armaduras|realeza,rey|lorc|*
chain-mail|Cota de malla|armaduras|armadura|willdabeast|*
broken-shield|Derrota|armaduras|escudo roto,fracaso|lorc|*
shield|Escudo|armaduras|defensa|sbed|*
checked-shield|Escudo de armas|armaduras|blasón,heráldica|lorc|*
gauntlet|Guantelete|armaduras|guante,armadura|delapouite|*
spartan-helmet|Guerrero|armaduras|casco,espartano|delapouite|*
laurel-crown|Laurel|armaduras|corona,victoria|lorc|*
queen-crown|Reina|armaduras|reina|lorc|*
round-shield|Rodela|armaduras|escudo|willdabeast|*
visored-helm|Yelmo|armaduras|casco|lorc|*
swimfins|Aletas|armaduras|buceo|delapouite|
skull-ring|Anillo de calavera|armaduras|sortija|lorc|
engagement-ring|Anillo de compromiso|armaduras|joya,boda|lorc|
swirl-ring|Anillo en espiral|armaduras||lorc|
spectacles|Anteojos|armaduras|gafas|lorc|
robber-mask|Antifaz de ladrón|armaduras|máscara,bandido|delapouite|
abdominal-armor|Armadura abdominal|armaduras|peto,faldar|delapouite|
heart-armor|Armadura con corazón|armaduras|peto,vida|delapouite|
layered-armor|Armadura de capas|armaduras||lorc|
belt-armor|Armadura de cinturón|armaduras|cinturón,faldar|delapouite|
spiked-armor|Armadura de pinchos|armaduras|púas|lorc|
lamellar|Armadura laminar|armaduras||lorc|
ninja-armor|Armadura ninja|armaduras||delapouite|
angel-outfit|Atuendo de ángel|armaduras|túnica,ángel|lorc|
bandana|Bandana|armaduras|pañuelo,cabeza|delapouite|
barbute|Barbuta|armaduras|casco,yelmo|lorc|
closed-barbute|Barbuta cerrada|armaduras|casco,yelmo|delapouite|
lab-coat|Bata de laboratorio|armaduras|científico|delapouite|
graduate-cap|Birrete|armaduras|graduación,estudios|delapouite|
reticule|Bolsito|armaduras|bolso|lorc|
walking-boot|Bota de caminar|armaduras||lorc|
leather-boot|Bota de cuero|armaduras|calzado|lorc|
ski-boot|Bota de esquí|armaduras|calzado|delapouite|
rubber-boot|Bota de goma|armaduras|calzado|delapouite|
metal-boot|Bota de metal|armaduras||delapouite|
fur-boot|Bota de piel|armaduras|calzado,peludo|delapouite|
sticky-boot|Bota pegajosa|armaduras||delapouite|
tabi-boot|Bota tabi|armaduras||darkzaitzev|
cowboy-boot|Bota vaquera|armaduras|calzado|delapouite|
steeltoe-boots|Botas de puntera de acero|armaduras||lorc|
chelsea-boot|Botín chelsea|armaduras|bota,calzado|delapouite|
bracers|Brazales|armaduras|brazalete,antebrazo|skoll|
bracer|Brazalete|armaduras|brazal|delapouite|
socks|Calcetines|armaduras|ropa|delapouite|
underwear-shorts|Calzoncillos|armaduras||delapouite|
shirt|Camisa|armaduras|ropa|lucasms|
mail-shirt|Camisa de malla|armaduras||lorc|
fur-shirt|Camisa de piel|armaduras|abrigo,pieles|delapouite|
t-shirt|Camiseta|armaduras|ropa|delapouite|
basketball-jersey|Camiseta de baloncesto|armaduras|camiseta,deporte|delapouite|
tank-top|Camiseta de tirantes|armaduras||delapouite|
sleeveless-top|Camiseta sin mangas|armaduras|ropa|delapouite|
cape|Capa|armaduras|manto|delapouite|
wing-cloak|Capa alada|armaduras||lorc|
cape-armor|Capa con armadura|armaduras|capa,hombreras|delapouite|
pirate-coat|Casaca pirata|armaduras||delapouite|
helmet|Casco|armaduras|yelmo|sbed|
stahlhelm|Casco alemán|armaduras|stahlhelm|skoll|
brodie-helmet|Casco Brodie|armaduras|casco,militar|skoll|
crested-helmet|Casco con cresta|armaduras|yelmo,penacho|lorc|
astronaut-helmet|Casco de astronauta|armaduras|casco,espacio|delapouite|
custodian-helmet|Casco de bobby|armaduras|policía,yelmo|delapouite|
diving-helmet|Casco de buzo|armaduras|escafandra|delapouite|
centurion-helmet|Casco de centurión|armaduras|romano,yelmo|delapouite|
american-football-helmet|Casco de fútbol americano|armaduras|casco,deporte|delapouite|
wooden-helmet|Casco de madera|armaduras||skoll|
mining-helmet|Casco de minero|armaduras||delapouite|
samurai-helmet|Casco de samurái|armaduras|kabuto|delapouite|
samus-helmet|Casco de Samus|armaduras|casco|delapouite|
warlord-helmet|Casco de señor de la guerra|armaduras||caro-asercion|
dwarf-helmet|Casco enano|armaduras|yelmo|kier-heyl|
gauls-helm|Casco galo|armaduras|yelmo,celta|delapouite|
full-motorcycle-helmet|Casco integral|armaduras|moto,casco|delapouite|
viking-helmet|Casco vikingo|armaduras||delapouite|
sleeveless-jacket|Chaleco|armaduras|ropa|delapouite|
kevlar-vest|Chaleco antibalas|armaduras|kevlar|skoll|
armor-vest|Chaleco blindado|armaduras|chaleco,protección|lorc|
leather-vest|Chaleco de cuero|armaduras||lorc|
life-jacket|Chaleco salvavidas|armaduras||delapouite|
flip-flops|Chanclas|armaduras|sandalias,calzado|delapouite|
top-hat|Chistera|armaduras|sombrero|lorc|
ribbon|Cinta|armaduras|cinta|lorc|
headband-knot|Cinta de cabeza|armaduras|diadema,ninja|delapouite|
belt|Cinturón|armaduras|cinto|lucasms|
black-belt|Cinturón negro|armaduras|artes marciales,cinto|delapouite|
elbow-pad|Coderas|armaduras|protección|delapouite|
pendant-key|Colgante de llave|armaduras|joya|delapouite|
tribal-pendant|Colgante tribal|armaduras||delapouite|
necklace|Collar|armaduras|joya|lucasms|
heart-necklace|Collar de corazón|armaduras|joya,colgante|delapouite|
gem-necklace|Collar de gemas|armaduras|joya,piedras|lorc|
pearl-necklace|Collar de perlas|armaduras|joya|delapouite|
spiked-collar|Collar de pinchos|armaduras|perro|lorc|
feather-necklace|Collar de plumas|armaduras|joya,tribal|delapouite|
double-necklace|Collar doble|armaduras|joya|delapouite|
intricate-necklace|Collar intrincado|armaduras|joya,colgante|delapouite|
heavy-collar|Collar pesado|armaduras|cadena,joya|delapouite|
primitive-necklace|Collar primitivo|armaduras|colgante,tribal|delapouite|
sewed-shell|Concha cosida|armaduras|tortuga|lorc|
trench-body-armor|Coraza de trinchera|armaduras||skoll|
tie|Corbata|armaduras||delapouite|
sharp-crown|Corona afilada|armaduras|púas|lorc|
hedjet-white-crown|Corona blanca egipcia|armaduras|hedjet,faraón|delapouite|
jewel-crown|Corona con joyas|armaduras|corona,rey|delapouite|
imperial-crown|Corona imperial|armaduras|corona,emperador|delapouite|
deshret-red-crown|Corona roja de Egipto|armaduras|faraón,deshret|delapouite|
corset|Corsé|armaduras|ropa|delapouite|
scale-mail|Cota de escamas|armaduras|armadura|lorc|
pschent-double-crown|Doble corona egipcia|armaduras|faraón,corona|delapouite|
battle-gear|Equipo de batalla|armaduras|armadura,guerra|lorc|
tribal-gear|Equipo tribal|armaduras||delapouite|
metal-scales|Escamas de metal|armaduras||lorc|
cracked-shield|Escudo agrietado|armaduras|roto|lorc|
winged-shield|Escudo alado|armaduras||lorc|
crenulated-shield|Escudo almenado|armaduras|almenas,muralla|lorc|
american-shield|Escudo americano|armaduras|escudo,estrella|delapouite|
riot-shield|Escudo antidisturbios|armaduras|policía|lorc|
bordered-shield|Escudo con borde|armaduras|escudo|lorc|
edged-shield|Escudo con filo|armaduras|escudo|lorc|
arrows-shield|Escudo con flechas|armaduras|escudo,flechas|lorc|
eye-shield|Escudo con ojo|armaduras|escudo,vigilancia|lorc|
trident-shield|Escudo con tridente|armaduras||delapouite|
skull-shield|Escudo de calavera|armaduras|cráneo|lorc|
bell-shield|Escudo de campana|armaduras|escudo,campana|lorc|
zebra-shield|Escudo de cebra|armaduras||lorc|
heart-shield|Escudo de corazón|armaduras|protección,vida|delapouite|
dragon-shield|Escudo de dragón|armaduras|escudo|delapouite|
griffin-shield|Escudo de grifo|armaduras|escudo,heráldica|delapouite|
cross-shield|Escudo de la cruz|armaduras|cruzado,templario|delapouite|
shieldcomb|Escudo de panal|armaduras|defensa|lorc|
spiked-shield|Escudo de pinchos|armaduras|púas|delapouite|
slashed-shield|Escudo rajado|armaduras|dañado|lorc|
surrounded-shield|Escudo rodeado|armaduras||lorc|
roman-shield|Escudo romano|armaduras|scutum,legionario|delapouite|
attached-shield|Escudo sujeto|armaduras|escudo,brazo|delapouite|
templar-shield|Escudo templario|armaduras||delapouite|
tribal-shield|Escudo tribal|armaduras||delapouite|
viking-shield|Escudo vikingo|armaduras||delapouite|
necklace-display|Expositor de collares|armaduras|joya|delapouite|
skirt|Falda|armaduras|ropa|delapouite|
metal-skirt|Falda de metal|armaduras||delapouite|
fez|Fez|armaduras|gorro,sombrero|delapouite|
prank-glasses|Gafas de broma|armaduras|disfraz,bigote|caro-asercion|
protection-glasses|Gafas de protección|armaduras|gafas|delapouite|
sunglasses|Gafas de sol|armaduras||delapouite|
steampunk-goggles|Gafas steampunk|armaduras||delapouite|
galea|Galea|armaduras|casco,romano|delapouite|
plate-claw|Garra de placas|armaduras|guantelete,garra|lorc|
billed-cap|Gorra con visera|armaduras|gorra,sombrero|delapouite|
chef-toque|Gorro de cocinero|armaduras|chef,cocina|delapouite|
propeller-beanie|Gorro de hélice|armaduras|gorro|delapouite|
winter-hat|Gorro de invierno|armaduras||delapouite|
santa-hat|Gorro de Papá Noel|armaduras|navidad|delapouite|
phrygian-cap|Gorro frigio|armaduras||delapouite|
greaves|Grebas|armaduras|espinilleras,armadura|delapouite|
gloves|Guantes|armaduras|manos,prenda|delapouite|
winter-gloves|Guantes de invierno|armaduras||delapouite|
belt-buckles|Hebillas de cinturón|armaduras|cinturón,hebilla|lorc|
shoulder-armor|Hombrera|armaduras|armadura|delapouite|
shoulder-scales|Hombrera de escamas|armaduras|armadura|lorc|
spiked-shoulder-armor|Hombrera de pinchos|armaduras|púas|delapouite|
pauldrons|Hombreras|armaduras||skoll|
lorgnette|Impertinentes|armaduras|anteojos|delapouite|
kevlar|Kevlar|armaduras|chaleco,protección|sbed|
kimono|Kimono|armaduras|ropa,japonés|delapouite|
bow-tie-ribbon|Lazo de pajarita|armaduras|pajarita,lazo|delapouite|
metal-hand|Mano de metal|armaduras||lorc|
cloak|Manto|armaduras|manto|lucasms|
cracked-mask|Máscara agrietada|armaduras|rota|lorc|
gas-mask|Máscara antigás|armaduras|gas,protección|lorc|
spider-mask|Máscara de araña|armaduras|superhéroe|delapouite|
architect-mask|Máscara de arquitecto|armaduras|máscara,casco|lorc|
scuba-mask|Máscara de buceo|armaduras|gafas|delapouite|
pumpkin-mask|Máscara de calabaza|armaduras|halloween|lorc|
skull-mask|Máscara de calavera|armaduras|cráneo|lorc|
gas-mask-skoll|Máscara de gas|armaduras|gas,protección|skoll|
iron-mask|Máscara de hierro|armaduras|prisionero,máscara|lorc|
jason-mask|Máscara de hockey|armaduras|asesino,terror|delapouite|
bat-mask|Máscara de murciélago|armaduras|máscara,cowl|delapouite|
bird-mask|Máscara de pájaro|armaduras|máscara,pico|lorc|
lightning-mask|Máscara de rayos|armaduras||lorc|
ninja-mask|Máscara ninja|armaduras||lorc|
tribal-mask|Máscara tribal|armaduras||lorc|
ribbon-medal|Medalla con cinta|armaduras|condecoración|delapouite|
sport-medal|Medalla deportiva|armaduras|premio|delapouite|
armor-cuisses|Musleras|armaduras|muslos,armadura|delapouite|
dunce-cap|Orejas de burro|armaduras|gorro,castigo|delapouite|
bow-tie|Pajarita|armaduras|corbatín,lazo|delapouite|
trousers|Pantalones|armaduras||lorc|
armored-pants|Pantalones blindados|armaduras|grebas,pantalón|irongamer|
shorts|Pantalones cortos|armaduras|ropa|delapouite|
trousers-lucasms|Pantalones de cuero|armaduras||lucasms|
eyepatch|Parche en el ojo|armaduras|pirata,tuerto|delapouite|
balaclava|Pasamontañas|armaduras|máscara,gorro|skoll|
wooden-pegleg|Pata de palo|armaduras||delapouite|
roller-skate|Patín|armaduras|calzado|delapouite|
pearl-earring|Pendiente de perla|armaduras|joya|delapouite|
earrings|Pendientes|armaduras|joyas|delapouite|
heart-earrings|Pendientes de corazón|armaduras|joya,aretes|delapouite|
crystal-earrings|Pendientes de cristal|armaduras|joyas|delapouite|
drop-earrings|Pendientes de gota|armaduras|joyas|delapouite|
chest-armor|Peto|armaduras|peto,pechera|delapouite|
plastron|Peto de armadura|armaduras|coraza,pechera|lorc|
pickelhaube|Pickelhaube|armaduras|casco|skoll|
lipstick|Pintalabios|armaduras|maquillaje|delapouite|
cowboy-holster|Pistolera|armaduras|cartuchera,revólver|delapouite|
metal-plate|Placa de metal|armaduras||delapouite|
moncler-jacket|Plumífero|armaduras|chaqueta|delapouite|
polo-shirt|Polo|armaduras|camiseta,ropa|delapouite|
poncho|Poncho|armaduras|capa,ropa|delapouite|
pteruges|Pteruges|armaduras|faldilla,romano|skoll|
mailed-fist|Puño de malla|armaduras|guantelete|lorc|
leg-armor|Quijotes|armaduras|pierna|delapouite|
knee-pad|Rodillera|armaduras||delapouite|
clothes|Ropa|armaduras|vestimenta|delapouite|
travel-dress|Ropa de viaje|armaduras||delapouite|
underwear|Ropa interior|armaduras||delapouite|
sandal|Sandalia|armaduras|calzado|delapouite|
outback-hat|Sombrero australiano|armaduras||delapouite|
cork-hat|Sombrero de corchos|armaduras|australiano|delapouite|
flower-hat|Sombrero de flores|armaduras|sombrero,flor|delapouite|
skimmer-hat|Sombrero de paja|armaduras|canotier|delapouite|
pilgrim-hat|Sombrero de peregrino|armaduras||delapouite|
robin-hood-hat|Sombrero de Robin Hood|armaduras|arquero|delapouite|
fedora|Sombrero fedora|armaduras|sombrero,gángster|lorc|
sombrero|Sombrero mexicano|armaduras|sombrero|delapouite|
pirate-hat|Sombrero pirata|armaduras||delapouite|
pointy-hat|Sombrero puntiagudo|armaduras|mago,bruja|lorc|
western-hat|Sombrero vaquero|armaduras||delapouite|
hoodie|Sudadera con capucha|armaduras|ropa,prenda|delapouite|
loincloth|Taparrabos|armaduras|ropa|delapouite|
tiara|Tiara|armaduras|corona|delapouite|
war-bonnet|Tocado de guerra|armaduras||delapouite|
roman-toga|Toga romana|armaduras|ropa|delapouite|
torc|Torque|armaduras|collar|cathelineau|
hazmat-suit|Traje de protección|armaduras|contaminación,biológico|delapouite|
space-suit|Traje espacial|armaduras|astronauta|lorc|
saiyan-suit|Traje saiyan|armaduras|armadura|delapouite|
robe|Túnica|armaduras|ropa,hábito|lorc|
turban|Turbante|armaduras||delapouite|
ushanka|Ushanka|armaduras|gorro|delapouite|
blindfold|Venda para los ojos|armaduras|antifaz,ceguera|delapouite|
dress|Vestido|armaduras|ropa|skoll|
ample-dress|Vestido amplio|armaduras|vestido,ropa|delapouite|
large-dress|Vestido de gala|armaduras|ropa|delapouite|
cracked-helm|Yelmo agrietado|armaduras|casco|lorc|
brutal-helm|Yelmo brutal|armaduras|casco,bárbaro|carl-olsen|
cadillac-helm|Yelmo Cadillac|armaduras|casco|delapouite|
horned-helm|Yelmo con cuernos|armaduras|casco,vikingo|lorc|
frog-mouth-helm|Yelmo de boca de rana|armaduras|casco,yelmo|caro-asercion|
black-knight-helm|Yelmo de caballero negro|armaduras|casco,caballero|delapouite|
overlord-helm|Yelmo de señor supremo|armaduras||delapouite|
light-helm|Yelmo ligero|armaduras|casco|delapouite|
heavy-helm|Yelmo pesado|armaduras|casco,yelmo|lorc|
running-shoe|Zapatilla de correr|armaduras|calzado|delapouite|
converse-shoe|Zapatilla de lona|armaduras|calzado,deportiva|delapouite|
slippers|Zapatillas|armaduras|calzado|delapouite|
ballerina-shoes|Zapatillas de ballet|armaduras|calzado,baile|delapouite|
bunny-slippers|Zapatillas de conejo|armaduras|calzado,pantuflas|caro-asercion|
high-heel|Zapato de tacón|armaduras|calzado,tacón|delapouite|
cement-shoes|Zapatos de cemento|armaduras|calzado,mafia|skoll|
sonic-shoes|Zapatos sónicos|armaduras|velocidad|delapouite|
wooden-clogs|Zuecos de madera|armaduras||delapouite|
spyglass|Anteojo|objetos|catalejo|lorc|*
torch|Antorcha|objetos||delapouite|*
bookshelf|Biblioteca|objetos|estantería,libros|delapouite|*
swap-bag|Bolsa|objetos|intercambio|lorc|*
compass|Brújula|objetos|navegación|lorc|*
cauldron|Caldero|objetos|olla,caldera|lorc|*
camping-tent|Campamento|objetos|tienda,acampar|delapouite|*
ringing-bell|Campana|objetos|tañer|lorc|*
padlock|Candado|objetos||lorc|*
wooden-sign|Cartel|objetos|letrero|lorc|*
telescope|Catalejo|objetos|telescopio|delapouite|*
rope-coil|Cuerda|objetos|soga|delapouite|*
backpack|Equipo|objetos|mochila,inventario|delapouite|*
mirror-mirror|Espejo|objetos||lorc|*
lantern-flame|Farol|objetos|llama,luz|lorc|*
anvil-impact|Fragua|objetos|yunque,herrería|lorc|*
square-bottle|Frasco|objetos|botella|lorc|*
lockpicks|Ganzúas|objetos|ladrón|delapouite|*
key|Llave|objetos||lorc|*
skeleton-key|Llave maestra|objetos|ganzúa|lorc|*
magnifying-glass|Lupa|objetos||lorc|*
hammer-nails|Martillo|objetos|clavos,herramienta|lorc|*
knapsack|Mochila|objetos||lorc|*
pocket-watch|Reloj|objetos|hora|skoll|*
hourglass|Reloj de arena|objetos|tiempo,arena|lorc|*
sundial|Reloj de sol|objetos||lorc|*
wolf-trap|Trampa|objetos||lorc|*
trophy|Trofeo|objetos|premio|lorc|*
candle-light|Vela|objetos|luz,cirio|lorc|*
poison-bottle|Veneno|objetos|tóxico,calavera|lorc|*
anvil|Yunque|objetos|herrería,forja|lorc|*
abacus|Ábaco|objetos|cálculo,contar|delapouite|
handheld-fan|Abanico|objetos|ventilador,abanico|delapouite|
clamp|Abrazadera|objetos|tornillo,sargento|delapouite|
unlocking|Abrir cerradura|objetos||lorc|
aquarium|Acuario|objetos|peces,pecera|delapouite|
spray|Aerosol|objetos|spray|lorc|
sewing-needle|Aguja de coser|objetos|costura|lorc|
barbed-wire|Alambre de espino|objetos|alambrada,valla|lorc|
ringing-alarm|Alarma sonando|objetos|alerta|delapouite|
door-ring-handle|Aldaba de anilla|objetos|llamador|delapouite|
red-carpet|Alfombra roja|objetos|gala|delapouite|
pillow|Almohada|objetos||delapouite|
amphora|Ánfora|objetos|vasija,jarra|delapouite|
primitive-torch|Antorcha primitiva|objetos|luz,fuego|delapouite|
fishing-hook|Anzuelo|objetos|pesca,gancho|lorc|
fishhook-fork|Anzuelo bifurcado|objetos|pesca,gancho|lorc|
plow|Arado|objetos|labranza,granja|delapouite|
sands-of-time|Arenas del tiempo|objetos|reloj de arena|lorc|
stick-frame|Armazón de palos|objetos||delapouite|
vacuum-cleaner|Aspiradora|objetos||delapouite|
astrolabe|Astrolabio|objetos|navegación,astronomía|caro-asercion|
dream-catcher|Atrapasueños|objetos|amuleto|delapouite|
park-bench|Banco de parque|objetos||delapouite|
paper-tray|Bandeja de papeles|objetos||delapouite|
bathtub|Bañera|objetos|baño,tina|delapouite|
metal-bar|Barra de metal|objetos||lorc|
barrier|Barrera|objetos|valla,bloqueo|delapouite|
barrel|Barril|objetos|tonel,cuba|delapouite|
barrel-leak|Barril con fuga|objetos|barril,goteo|delapouite|
oil-drum|Barril de petróleo|objetos||skoll|
cellar-barrels|Barriles de bodega|objetos|toneles,sótano|delapouite|
weight-scale|Báscula|objetos||delapouite|
kitchen-scale|Báscula de cocina|objetos|peso|delapouite|
whisk|Batidor|objetos||delapouite|
blender|Batidora|objetos|cocina,licuadora|caro-asercion|
baby-bottle|Biberón|objetos|bebé,leche|delapouite|
jerrycan|Bidón|objetos|combustible,garrafa|delapouite|
scalpel|Bisturí|objetos|cirugía|lorc|
thwomp|Bloque aplastante|objetos||delapouite|
stone-block|Bloque de piedra|objetos||lorc|
wrecking-ball|Bola de demolición|objetos||lorc|
glass-ball|Bola de vidrio|objetos|esfera,vidrio|delapouite|
caged-ball|Bola enjaulada|objetos|esfera,jaula|lorc|
pouch-with-beads|Bolsa con cuentas|objetos|saquito,abalorios|seregacthtuf|
gym-bag|Bolsa de deporte|objetos|equipaje,mochila|delapouite|
disc-golf-bag|Bolsa de disc golf|objetos|deporte|delapouite|
shopping-bag|Bolsa de la compra|objetos|compras|delapouite|
paper-bag-open|Bolsa de papel abierta|objetos||caro-asercion|
paper-bag-crumpled|Bolsa de papel arrugada|objetos||caro-asercion|
paper-bag-folded|Bolsa de papel doblada|objetos||caro-asercion|
beach-bag|Bolsa de playa|objetos|bolsa,playa|delapouite|
shoulder-bag|Bolso de hombro|objetos|bandolera|delapouite|
manual-water-pump|Bomba de agua manual|objetos||delapouite|
light-bulb|Bombilla|objetos|idea,luz|lorc|
aerosol|Bote de aerosol|objetos|spray,bote|lorc|
water-bottle|Botella de agua|objetos||delapouite|
snow-bottle|Botella de nieve|objetos|frasco|lorc|
spiral-bottle|Botella en espiral|objetos|frasco|lorc|
broken-bottle|Botella rota|objetos|cristal,botella|lorc|
scuba-tanks|Botellas de buceo|objetos|oxígeno|delapouite|
first-aid-kit|Botiquín|objetos|primeros auxilios,medicina|delapouite|
shirt-button|Botón de camisa|objetos|ropa|delapouite|
buoy|Boya|objetos|mar,flotador|delapouite|
brasero|Brasero|objetos|fuego,calefacción|delapouite|
large-paint-brush|Brocha grande|objetos|pintura|delapouite|
boiling-bubbles|Burbujas hirviendo|objetos|ebullición,caldero|lorc|
stone-bust|Busto de piedra|objetos|estatua|delapouite|
mailbox|Buzón|objetos|correo|delapouite|
easel|Caballete|objetos|pintura|caro-asercion|
match-head|Cabeza de cerilla|objetos||lorc|
tripwire|Cable trampa|objetos||lorc|
wavy-chains|Cadenas ondulantes|objetos||lorc|
locked-box|Caja cerrada|objetos||delapouite|
ring-box|Caja de anillo|objetos|joyero|delapouite|
cargo-crate|Caja de carga|objetos|cajón,embalaje|delapouite|
cardboard-box|Caja de cartón|objetos|embalaje|delapouite|
cardboard-box-closed|Caja de cartón cerrada|objetos|embalaje|delapouite|
matchbox|Caja de cerillas|objetos||delapouite|
toolbox|Caja de herramientas|objetos||delapouite|
wooden-crate|Caja de madera|objetos||delapouite|
skull-in-jar|Calavera en tarro|objetos|cráneo|lorc|
cauldron-darkzaitzev|Caldero burbujeante|objetos|olla,brujería|darkzaitzev|
jeweled-chalice|Cáliz con joyas|objetos|copa,tesoro|lorc|
pouring-chalice|Cáliz derramado|objetos|copa,verter|lorc|
bed|Cama|objetos|lecho,dormir|delapouite|
windchimes|Campanillas de viento|objetos||caro-asercion|
padlock-open|Candado abierto|objetos||delapouite|
combination-lock|Candado de combinación|objetos|cerradura|skoll|
dial-padlock|Candado de rueda|objetos|combinación|delapouite|
plain-padlock|Candado simple|objetos||delapouite|
unlit-candelabra|Candelabro apagado|objetos||lorc|
candlebright|Candelabro brillante|objetos|candelabro,luz|lorc|
lit-candelabra|Candelabro encendido|objetos|velas|lorc|
candle-holder|Candelero|objetos|vela,portavelas|lorc|
jug|Cántaro|objetos|cántaro,recipiente|delapouite|
water-flask|Cantimplora|objetos||delapouite|
fishing-pole|Caña de pescar|objetos|pesca,anzuelo|delapouite|
wheelbarrow|Carretilla|objetos||delapouite|
hand-truck|Carretilla de mano|objetos|carga,transporte|delapouite|
shopping-cart|Carrito de la compra|objetos|compras|delapouite|
hanging-sign|Cartel colgante|objetos|letrero,taberna|delapouite|
bird-house|Casa de pájaros|objetos|nido,pajarera|delapouite|
audio-cassette|Casete|objetos|cinta,música|delapouite|
dig-hole|Cavar hoyo|objetos|pala,agujero|delapouite|
shepherds-crook|Cayado de pastor|objetos|báculo|generalace135|
toothbrush|Cepillo de dientes|objetos||caro-asercion|
mantrap|Cepo|objetos|trampa|lorc|
painted-pottery|Cerámica pintada|objetos||delapouite|
broken-pottery|Cerámica rota|objetos|vasija,tiesto|delapouite|
cog-lock|Cerradura de engranajes|objetos|candado,mecanismo|lorc|
lock-spy|Cerradura espía|objetos||delapouite|
basket|Cesta|objetos|cesto,canasta|delapouite|
winged-scepter|Cetro alado|objetos||delapouite|
bird-scepter|Cetro de ave|objetos|cetro,realeza|delapouite|
bottle-cap|Chapa de botella|objetos|tapón,corona|delapouite|
fireplace|Chimenea|objetos|hogar,fuego|delapouite|
pin|Chincheta|objetos||delapouite|
flint-spark|Chispa de pedernal|objetos|yesca,fuego|delapouite|
chisel|Cincel|objetos|herramienta,escultor|delapouite|
measure-tape|Cinta métrica|objetos||delapouite|
crime-scene-tape|Cinta policial|objetos|crimen,barrera|delapouite|
bolt-cutter|Cizalla|objetos|herramienta,cortapernos|delapouite|
coiled-nail|Clavo enroscado|objetos|tornillo|delapouite|
nails|Clavos|objetos||lorc|
barbed-nails|Clavos con púas|objetos|clavos,pinchos|lorc|
paper-clip|Clip|objetos||delapouite|
coa-de-jima|Coa de jima|objetos|herramienta,agave|delapouite|
gas-stove|Cocina de gas|objetos|fogón,cocina|delapouite|
beehive|Colmena|objetos|abejas,miel|delapouite|
artificial-hive|Colmena artificial|objetos|abejas,apicultura|lorc|
traffic-cone|Cono de tráfico|objetos||delapouite|
trophy-cup|Copa de trofeo|objetos|premio|delapouite|
glass-heart|Corazón de cristal|objetos|vidrio,frágil|lorc|
zipper|Cremallera|objetos|cierre|delapouite|
shattered-glass|Cristal hecho añicos|objetos|vidrio|lorc|
cracked-glass|Cristal roto|objetos|vidrio|lorc|
stopwatch|Cronómetro|objetos||lorc|
stopwatch-skoll|Cronómetro rápido|objetos||skoll|
foundry-bucket|Cuba de fundición|objetos|metal,fundir|delapouite|
companion-cube|Cubo de compañía|objetos|cubo,corazón|delapouite|
empty-wood-bucket-handle|Cubo de madera con asa|objetos|balde|delapouite|
full-wood-bucket|Cubo de madera lleno|objetos|balde,cubeta|delapouite|
full-wood-bucket-handle|Cubo de madera lleno con asa|objetos|balde,cubeta|delapouite|
empty-wood-bucket|Cubo de madera vacío|objetos|balde|delapouite|
full-metal-bucket|Cubo de metal lleno|objetos|balde,cubeta|delapouite|
full-metal-bucket-handle|Cubo de metal lleno con asa|objetos|balde,cubeta|delapouite|
paint-bucket|Cubo de pintura|objetos||delapouite|
beach-bucket|Cubo de playa|objetos|cubo,arena|delapouite|
empty-metal-bucket-handle|Cubo metálico con asa|objetos|balde|delapouite|
empty-metal-bucket|Cubo metálico vacío|objetos|balde|delapouite|
spoon|Cuchara|objetos|cubierto|lorc|
fishing-spoon|Cucharilla de pesca|objetos|señuelo,pesca|delapouite|
razor-blade|Cuchilla de afeitar|objetos|hoja|lorc|
kitchen-knives|Cuchillos de cocina|objetos||lorc|
fire-bowl|Cuenco de fuego|objetos|fuego,hoguera|lorc|
dog-bowl|Cuenco de perro|objetos|comedero|delapouite|
bowl-spiral|Cuenco en espiral|objetos|cuenco,remolino|lorc|
eyedropper|Cuentagotas|objetos|gotero,pipeta|lorc|
claw-string|Cuerda con garra|objetos|gancho|lorc|
swirl-string|Cuerda en espiral|objetos||lorc|
horn-internal|Cuerno interior|objetos|trompa,cuerno|lorc|
mighty-horn|Cuerno poderoso|objetos||delapouite|
water-tank|Depósito de agua|objetos||delapouite|
spill|Derrame|objetos|líquido|lorc|
plunger|Desatascador|objetos|ventosa|delapouite|
box-unpacking|Desembalaje|objetos|caja,abrir|delapouite|
alarm-clock|Despertador|objetos|reloj,alarma|delapouite|
screwdriver|Destornillador|objetos|herramienta|lorc|
metal-disc|Disco de metal|objetos||lorc|
two-feathers|Dos plumas|objetos||lorc|
shower|Ducha|objetos|baño|delapouite|
funnel|Embudo|objetos|verter,cocina|delapouite|
hand-grip|Empuñar|objetos|agarre,mango|delapouite|
ladder|Escalera de mano|objetos||delapouite|
3d-stairs|Escaleras 3D|objetos|escalones,isométrico|delapouite|
broom|Escoba|objetos|barrer,bruja|delapouite|
airtight-hatch|Escotilla estanca|objetos|compuerta,submarino|delapouite|
desk|Escritorio|objetos|mesa,mueble|delapouite|
stone-sphere|Esfera de piedra|objetos||lorc|
scarecrow|Espantapájaros|objetos|granja|lorc|
barbed-coil|Espiral de púas|objetos|alambrada,espino|lorc|
handcuffed|Esposado|objetos|preso,grilletes|delapouite|
handcuffs|Esposas|objetos|grilletes,preso|lorc|
trophies-shelf|Estante de trofeos|objetos||delapouite|
stethoscope|Estetoscopio|objetos|médico|delapouite|
expander|Expansor|objetos|ejercicio,muelle|sbed|
soap-experiment|Experimento de jabón|objetos|pompas|lorc|
fire-extinguisher|Extintor|objetos|incendio,bombero|delapouite|
crafting|Fabricación|objetos|artesanía,manos|delapouite|
fog-light|Faro antiniebla|objetos|luz,coche|delapouite|
old-lantern|Farol antiguo|objetos|luz|delapouite|
pumpkin-lantern|Farol de calabaza|objetos|halloween,luz|lorc|
lantern|Farol de mano|objetos|luz|lorc|
street-light|Farola|objetos||delapouite|
double-street-lights|Farolas dobles|objetos|luz,calle|delapouite|
asian-lantern|Farolillo asiático|objetos|linterna,luz|delapouite|
paper-lantern|Farolillo de papel|objetos||lorc|
sword-smithing|Forjar espada|objetos|herrería|lorc|
lock-picking|Forzar cerradura|objetos|ladrón|delapouite|
fragrance|Fragancia|objetos|perfume,aroma|lorc|
perfume-bottle|Frasco de perfume|objetos||lorc|
sink|Fregadero|objetos|lavabo|caro-asercion|
bellows|Fuelle|objetos|forja,aire|delapouite|
water-fountain|Fuente de agua|objetos||delapouite|
bamboo-fountain|Fuente de bambú|objetos|jardín,agua|delapouite|
3d-glasses|Gafas 3D|objetos|cine,lentes|delapouite|
hook|Gancho|objetos|garfio|delapouite|
meat-hook|Gancho de carnicero|objetos||lorc|
water-gallon|Garrafa de agua|objetos||delapouite|
chemical-drop|Gota química|objetos|ácido,líquido|lorc|
test-tube-rack|Gradilla de tubos|objetos|laboratorio|caro-asercion|
stapler|Grapadora|objetos|oficina|caro-asercion|
stapler-heavy-duty|Grapadora industrial|objetos||caro-asercion|
tap|Grifo de agua|objetos||delapouite|
kitchen-tap|Grifo de cocina|objetos|agua|delapouite|
marble-tap|Grifo de mármol|objetos||delapouite|
manacles|Grilletes|objetos|esposas|lorc|
guillotine|Guillotina|objetos|ejecución,cuchilla|lorc|
wood-axe|Hacha de leñador|objetos||lorc|
axe-in-stump|Hacha en tocón|objetos|leña,leñador|lorc|
axe-in-log|Hacha en tronco|objetos|leña,tronco|delapouite|
bindle|Hatillo|objetos|fardo,vagabundo|delapouite|
froe-and-mallet|Hendedor y mazo|objetos|carpintería,herramientas|caro-asercion|
horseshoe|Herradura|objetos|suerte,caballo|delapouite|
sewing-string|Hilo de coser|objetos|costura|delapouite|
solar-time|Hora solar|objetos|reloj de sol|delapouite|
gibbet|Horca de ahorcado|objetos|patíbulo,ahorcado|lorc|
furnace|Horno de fundición|objetos|fragua,fuego|delapouite|
falling-ovoid|Huevo cayendo|objetos|caída,óvalo|lorc|
koholint-egg|Huevo de Koholint|objetos||delapouite|
magnet|Imán|objetos||lorc|
safety-pin|Imperdible|objetos|alfiler|delapouite|
soap|Jabón|objetos|limpieza|delapouite|
liquid-soap|Jabón líquido|objetos||delapouite|
porcelain-vase|Jarrón de porcelana|objetos|florero,vasija|delapouite|
cage|Jaula|objetos|prisión,encierro|delapouite|
circle-cage|Jaula circular|objetos|prisión|lorc|
bird-cage|Jaula de pájaros|objetos|jaula,ave|delapouite|
zigzag-cage|Jaula en zigzag|objetos||lorc|
clay-brick|Ladrillo|objetos|construcción,barro|delapouite|
s-brick|Ladrillo en S|objetos|bloque|delapouite|
t-brick|Ladrillo en T|objetos||delapouite|
z-brick|Ladrillo en Z|objetos||delapouite|
bed-lamp|Lámpara de cama|objetos|lámpara,mesilla|delapouite|
desk-lamp|Lámpara de escritorio|objetos|luz,flexo|lorc|
ceiling-light|Lámpara de techo|objetos|luz,plafón|delapouite|
flexible-lamp|Lámpara flexible|objetos|flexo,luz|delapouite|
wool|Lana|objetos||delapouite|
pencil-ruler|Lápiz y regla|objetos||delapouite|
oil-can|Lata de aceite|objetos||delapouite|
slavery-whip|Látigo de esclavos|objetos|azote|lorc|
washing-machine|Lavadora|objetos||delapouite|
lasso|Lazo|objetos|cuerda|delapouite|
spectacle-lenses|Lentes de gafas|objetos|cristales|lorc|
flashlight|Linterna|objetos|luz,foco|delapouite|
bunk-beds|Literas|objetos|camas,dormitorio|delapouite|
candle-flame|Llama de vela|objetos|vela,fuego|lorc|
wrench|Llave ajustable|objetos||sbed|
key-sbed|Llave antigua|objetos||sbed|
car-key|Llave de coche|objetos|automóvil|delapouite|
heart-key|Llave de corazón|objetos|amor,llave|delapouite|
tire-iron-cross|Llave de cruceta|objetos||delapouite|
tire-iron|Llave de cruz|objetos||delapouite|
boss-key|Llave del jefe|objetos|llave,jefe|delapouite|
millenium-key|Llave del milenio|objetos||delapouite|
lightning-spanner|Llave eléctrica|objetos||lorc|
star-key|Llave estrella|objetos||delapouite|
spanner|Llave fija|objetos|herramienta|lorc|
monkey-wrench|Llave inglesa|objetos||delapouite|
mighty-spanner|Llave poderosa|objetos||lorc|
key-lock|Llave y cerradura|objetos|candado|delapouite|
keyring|Llavero|objetos|llaves|delapouite|
house-keys|Llaves de casa|objetos|llaves,hogar|delapouite|
dungeon-light|Luz de mazmorra|objetos|antorcha|delapouite|
wall-light|Luz de pared|objetos||delapouite|
flower-pot|Maceta|objetos|flor,planta|lorc|
suitcase|Maleta|objetos||delapouite|
rolling-suitcase|Maleta con ruedas|objetos|equipaje|caro-asercion|
briefcase|Maletín|objetos|cartera,portafolios|delapouite|
windsock|Manga de viento|objetos||delapouite|
cooking-glove|Manopla de cocina|objetos|guante|delapouite|
blanket|Manta|objetos|cobija,tela|delapouite|
wood-frame|Marco de madera|objetos||delapouite|
claw-hammer|Martillo de orejas|objetos|herramienta|lorc|
flat-hammer|Martillo plano|objetos|herramienta,mazo|lorc|
trap-mask|Máscara trampa|objetos||lorc|
erlenmeyer|Matraz|objetos|laboratorio,frasco|lorc|
round-bottom-flask|Matraz de fondo redondo|objetos|laboratorio|lorc|
banging-gavel|Mazo de juez|objetos|juicio,justicia|delapouite|
toy-mallet|Mazo de juguete|objetos||delapouite|
rocking-chair|Mecedora|objetos|silla|delapouite|
lighter|Mechero|objetos|fuego|delapouite|
megaphone|Megáfono|objetos||delapouite|
acoustic-megaphone|Megáfono acústico|objetos|altavoz,bocina|delapouite|
table|Mesa|objetos||delapouite|
round-table|Mesa redonda|objetos|artúrica|delapouite|
melting-metal|Metal fundido|objetos||delapouite|
old-microphone|Micrófono antiguo|objetos||delapouite|
mining|Minería|objetos|pico|lorc|
school-bag|Mochila escolar|objetos|cartera|delapouite|
light-backpack|Mochila ligera|objetos||delapouite|
ring-mould|Molde de anillo|objetos|joyería|delapouite|
sword-mold|Molde de espada|objetos|forja|delapouite|
lift|Montacargas|objetos||lorc|
wood-pile|Montón de leña|objetos||delapouite|
pestle-mortar|Mortero y maja|objetos|alquimia|skoll|
carabiner|Mosquetón|objetos|escalada|delapouite|
bouncing-spring|Muelle saltarín|objetos|resorte,rebote|delapouite|
target-dummy|Muñeco de prácticas|objetos||lorc|
razor|Navaja de afeitar|objetos|cuchilla|delapouite|
swiss-army-knife|Navaja suiza|objetos||delapouite|
fridge|Nevera|objetos|frigorífico,cocina|caro-asercion|
cooler|Nevera portátil|objetos|hielo|delapouite|
knot|Nudo|objetos|cuerda|delapouite|
slipknot|Nudo corredizo|objetos|cuerda|delapouite|
waterskin|Odre|objetos||delapouite|
brass-eye|Ojo de latón|objetos|ojo,metal|lorc|
yarn|Ovillo de lana|objetos||delapouite|
spade|Pala|objetos|excavar|lorc|
spade-skull|Pala con calavera|objetos|tumba|lorc|
crowbar|Palanca|objetos|herramienta|delapouite|
lever|Palanca de mando|objetos||lorc|
trowel|Paleta|objetos|albañil|delapouite|
palette|Paleta de pintor|objetos||delapouite|
wood-stick|Palo de madera|objetos||delapouite|
trash-can|Papelera|objetos||delapouite|
umbrella|Paraguas|objetos||lorc|
comb|Peine|objetos|cabello|lorc|
pendulum-swing|Péndulo|objetos||delapouite|
hanger|Percha|objetos|ropa,colgar|delapouite|
delicate-perfume|Perfume delicado|objetos|frasco,fragancia|delapouite|
periscope|Periscopio|objetos||delapouite|
kaleidoscope-pearls|Perlas de caleidoscopio|objetos|cuentas,colores|lorc|
weight|Pesa|objetos||delapouite|
fishing|Pesca|objetos|caña,pescar|delapouite|
duffel-bag|Petate|objetos|bolsa,mochila|delapouite|
animal-hide|Piel de animal|objetos|cuero,pelaje|delapouite|
stack|Pila|objetos|montón|delapouite|
brick-pile|Pila de ladrillos|objetos|ladrillos,construcción|delapouite|
paint-brush|Pincel|objetos||delapouite|
pencil-brush|Pincel y lápiz|objetos||delapouite|
spikes|Pinchos|objetos|púas|sbed|
spikes-half|Pinchos a medias|objetos|púas|sbed|
spikes-full|Pinchos completos|objetos|púas|sbed|
spikes-init|Pinchos iniciales|objetos|púas|sbed|
clothespin|Pinza de ropa|objetos|tendedero|delapouite|
ball-pyramid|Pirámide de bolas|objetos|bolas,montón|delapouite|
orrery|Planetario|objetos||caro-asercion|
platform|Plataforma|objetos|tarima|skoll|
ladders-platform|Plataforma con escaleras|objetos||delapouite|
flat-platform|Plataforma plana|objetos|tarima,base|delapouite|
fishing-jig|Plomada de pesca|objetos|señuelo,anzuelo|delapouite|
pulley-hook|Polea con gancho|objetos|garfio|delapouite|
powder|Polvo|objetos|polvos|lorc|
door-handle|Pomo de puerta|objetos|manilla|delapouite|
round-knob|Pomo redondo|objetos|tirador|delapouite|
binoculars|Prismáticos|objetos|catalejos,vista|delapouite|
stockpiles|Provisiones|objetos|almacén|delapouite|
light-projector|Proyector de luz|objetos|foco|delapouite|
floor-polisher|Pulidora de suelo|objetos|limpieza,máquina|delapouite|
match-tip|Punta de cerilla|objetos||lorc|
boombox|Radiocasete|objetos|música,radio|delapouite|
rake|Rastrillo de jardín|objetos|jardín,herramienta|delapouite|
fishing-net|Red de pesca|objetos|red,pescar|lorc|
bug-net|Red para insectos|objetos|red,mariposas|delapouite|
watering-can|Regadera|objetos||delapouite|
present|Regalo|objetos|obsequio,paquete|delapouite|
gift-trap|Regalo trampa|objetos|paquete,cebo|lorc|
empty-hourglass|Reloj de arena vacío|objetos|tiempo|lorc|
cuckoo-clock|Reloj de cuco|objetos|péndulo|delapouite|
watch|Reloj de pulsera|objetos||delapouite|
bloody-stash|Reserva ensangrentada|objetos|botín,sangre|lorc|
spring|Resorte|objetos|muelle|delapouite|
paint-roller|Rodillo de pintura|objetos||delapouite|
wire-coil|Rollo de alambre|objetos||delapouite|
spinning-wheel|Rueca|objetos|hilar|caro-asercion|
flaming-sheet|Sábana en llamas|objetos|fuego,tela|lorc|
corkscrew|Sacacorchos|objetos|vino|delapouite|
fertilizer-bag|Saco de abono|objetos|fertilizante,granja|delapouite|
punching-bag|Saco de boxeo|objetos|boxeo|delapouite|
concrete-bag|Saco de cemento|objetos|construcción|delapouite|
sleeping-bag|Saco de dormir|objetos|acampada|delapouite|
direction-sign|Señal de dirección|objetos|cartel,poste|delapouite|
fishing-lure|Señuelo de pesca|objetos|cebo,anzuelo|delapouite|
hand-saw|Serrucho|objetos|sierra,herramienta|delapouite|
sextant|Sextante|objetos|navegación|delapouite|
circular-saw|Sierra circular|objetos|herramienta|sbed|
crosscut-saw|Sierra de tronzar|objetos|sierra,herramienta|delapouite|
whistle|Silbato|objetos||delapouite|
director-chair|Silla de director|objetos|cine|delapouite|
wooden-chair|Silla de madera|objetos||delapouite|
office-chair|Silla de oficina|objetos||delapouite|
armchair|Sillón|objetos|butaca,mueble|caro-asercion|
siren|Sirena de alarma|objetos|alarma|skoll|
sofa|Sofá|objetos|mueble|delapouite|
soldering-iron|Soldador|objetos|herramienta|caro-asercion|
planks|Tablas|objetos|madera|delapouite|
packed-planks|Tablones apilados|objetos||delapouite|
bar-stool|Taburete de bar|objetos|taburete,mueble|delapouite|
drill|Taladro|objetos|herramienta|lorc|
needle-drill|Taladro de aguja|objetos||lorc|
drill-delapouite|Taladro eléctrico|objetos|herramienta|delapouite|
stone-crafting|Tallar piedra|objetos|cantería|lorc|
lockers|Taquillas|objetos||delapouite|
swipe-card|Tarjeta de acceso|objetos||delapouite|
key-card|Tarjeta llave|objetos|acceso|delapouite|
cloth-jar|Tarro con tela|objetos|frasco,bote|delapouite|
mason-jar|Tarro de cristal|objetos||caro-asercion|
covered-jar|Tarro tapado|objetos|vasija,tinaja|delapouite|
rolled-cloth|Tela enrollada|objetos|tejido|delapouite|
candlestick-phone|Teléfono de candelero|objetos|teléfono,antiguo|delapouite|
heavy-timer|Temporizador pesado|objetos|reloj,cuenta atrás|lorc|
pincers|Tenazas|objetos||lorc|
clothesline|Tendedero|objetos|cuerda,colada|caro-asercion|
thermometer-scale|Termómetro|objetos||lorc|
thermometer-hot|Termómetro caliente|objetos||delapouite|
thermometer-cold|Termómetro frío|objetos||delapouite|
teapot|Tetera|objetos||lorc|
scissors|Tijeras|objetos|cortar|lorc|
scissors-john-redman|Tijeras abiertas|objetos|cortar|john-redman|
gardening-shears|Tijeras de jardín|objetos|jardinería,podadera|delapouite|
shears|Tijeras de podar|objetos|cizalla|delapouite|
towel|Toalla|objetos||delapouite|
screw|Tornillo|objetos|herramienta|lorc|
ancient-screw|Tornillo de Arquímedes|objetos|bomba,antiguo|delapouite|
screw-delapouite|Tornillo de rosca|objetos|herramienta|delapouite|
turnstile|Torno|objetos||delapouite|
toaster|Tostadora|objetos||delapouite|
box-trap|Trampa de caja|objetos|trampa,caja|skoll|
grease-trap|Trampa de grasa|objetos|cocina,sifón|lorc|
three-keys|Tres llaves|objetos||lorc|
triple-needle|Triple aguja|objetos||lorc|
triple-plier|Triple alicate|objetos||lorc|
triple-lock|Triple cerradura|objetos||lorc|
stone-throne|Trono de piedra|objetos||lorc|
throne-king|Trono del rey|objetos||delapouite|
warp-pipe|Tubería de salto|objetos||delapouite|
straight-pipe|Tubería recta|objetos||delapouite|
pipes|Tuberías|objetos||delapouite|
corked-tube|Tubo con corcho|objetos|probeta,frasco|lorc|
snorkel|Tubo de buceo|objetos|buceo|sbed|
test-tube-held|Tubo de ensayo en mano|objetos|alquimia|caro-asercion|
tee-pipe|Tubo en T|objetos||delapouite|
dripping-tube|Tubo goteante|objetos|probeta,líquido|lorc|
test-tubes|Tubos de ensayo|objetos|laboratorio|lorc|
hexagonal-nut|Tuerca hexagonal|objetos|herramienta,tornillo|delapouite|
egyptian-urns|Urnas egipcias|objetos|vasijas|delapouite|
stakes-fence|Valla de estacas|objetos|valla,estacas|delapouite|
wooden-fence|Valla de madera|objetos||lorc|
valve|Válvula|objetos||delapouite|
water-diviner-stick|Varilla de zahorí|objetos||delapouite|
column-vase|Vasija con columna|objetos|jarrón|delapouite|
snake-jar|Vasija de serpiente|objetos|tarro|delapouite|
candles|Velas|objetos|cirios,luz|delapouite|
wood-beam|Viga de madera|objetos||delapouite|
i-beam|Viga en I|objetos|construcción,acero|delapouite|
dragon-breath|Aliento de dragón|magia|fuego|lorc|*
aura|Aura|magia|resplandor,energía|lorc|*
wizard-staff|Báculo|magia|bastón|lorc|*
crystal-ball|Bola de cristal|magia|adivinación|lorc|*
fireball|Bola de fuego|magia|hechizo,llamas|lorc|*
orb-wand|Cetro|magia|orbe|willdabeast|*
sparkles|Destellos|magia|brillos|delapouite|*
lightning-frequency|Energía|magia|rayo,electricidad|lorc|*
star-swirl|Estrellas|magia|remolino|lorc|*
spell-book|Grimorio|magia|libro de hechizos|delapouite|*
bolt-spell-cast|Lanzar conjuro|magia|rayo,hechizo|delapouite|*
evil-moon|Luna maldita|magia|luna|lorc|*
magic-swirl|Magia|magia|remolino|lorc|*
cursed-star|Maldición|magia|estrella,hechizo|lorc|*
music-spell|Música|magia|hechizo|lorc|*
smoking-orb|Orbe|magia|humo|lorc|*
pentacle|Pentáculo|magia||skoll|*
potion-ball|Poción|magia|frasco|lorc|*
portal|Portal|magia|puerta mágica|lorc|*
magic-portal|Portal mágico|magia||lorc|*
fire-ray|Rayo de fuego|magia|hechizo,llamas|lorc|*
ice-bolt|Rayo de hielo|magia|hechizo,escarcha|lorc|*
rune-stone|Runa|magia|piedra rúnica|lorc|*
fairy-wand|Varita|magia|hada,vara|lorc|*
crystal-wand|Varita de cristal|magia|vara|lorc|*
acid|Ácido|magia|corrosión,gota|sbed|
shadow-grasp|Agarre de sombra|magia|sombra|lorc|
thunder-struck|Alcanzado por un rayo|magia||lorc|
energy-breath|Aliento de energía|magia|rayo|lorc|
raise-skeleton|Alzar esqueleto|magia|nigromancia,invocar|skoll|
raise-zombie|Alzar zombi|magia|nigromancia,invocar|skoll|
fire-ring|Anillo de fuego|magia|aro,llamas|lorc|
power-ring|Anillo de poder|magia|sortija|delapouite|
frozen-ring|Anillo helado|magia|aro,hielo|delapouite|
lightning-tree|Árbol de rayos|magia||lorc|
lightning-arc|Arco eléctrico|magia|rayo|lorc|
glowing-artifact|Artefacto brillante|magia|reliquia,objeto mágico|delapouite|
love-howl|Aullido de amor|magia||lorc|
icicles-aura|Aura de carámbanos|magia|hielo,escarcha|lorc|
beams-aura|Aura de rayos|magia|rayos,resplandor|lorc|
rear-aura|Aura trasera|magia|energía|lorc|
crystal-bars|Barras de cristal|magia|lingotes|lorc|
skull-staff|Bastón de calavera|magia|nigromante|delapouite|
ball-glow|Bola brillante|magia|esfera,luz|lorc|
thunderball|Bola de trueno|magia||lorc|
vibrating-ball|Bola vibrante|magia||lorc|
burning-blobs|Bolas ardientes|magia|fuego,llamas|lorc|
dragon-balls|Bolas de dragón|magia|esferas|lorc|
bolt-bomb|Bomba relámpago|magia|rayo,explosivo|delapouite|
crystal-shine|Brillo de cristal|magia|destello|lorc|
skull-bolt|Calavera con rayo|magia|cráneo|lorc|
thunder-skull|Calavera del trueno|magia|rayo|lorc|
bubble-field|Campo de burbujas|magia|burbujas,escudo|lorc|
twirl-center|Centro del remolino|magia||lorc|
circle-sparks|Círculo de chispas|magia|destellos|lorc|
evil-comet|Cometa maligno|magia|astro|lorc|
fireflake|Copo de fuego|magia|llama,ascua|sbed|
tension-snowflake|Copo en tensión|magia|hielo|lorc|
shining-heart|Corazón brillante|magia|amor|lorc|
electrical-crescent|Creciente eléctrico|magia|rayo,luna|lorc|
crystal-growth|Crecimiento de cristales|magia|cuarzo|lorc|
floating-crystal|Cristal flotante|magia|gema,levitar|lorc|
crystalize|Cristalizar|magia|congelar|lorc|
bubbling-bowl|Cuenco burbujeante|magia|poción,caldero|lorc|
lightning-dome|Cúpula de rayos|magia||delapouite|
dice-fire|Dado de fuego|magia|llamas,dado|delapouite|
disintegrate|Desintegrar|magia|polvo,destruir|lorc|
cross-flare|Destello en cruz|magia|brillo,estrella|lorc|
ember-shot|Disparo de brasas|magia|fuego|lorc|
gift-of-knowledge|Don del conocimiento|magia|sabiduría,regalo|lorc|
marrow-drain|Drenar médula|magia||lorc|
life-tap|Drenar vida|magia|sangre|lorc|
electric|Electricidad|magia|rayo,energía|sbed|
embrassed-energy|Energía abrazada|magia|aura|lorc|
rolling-energy|Energía rodante|magia|bola|lorc|
energise|Energizar|magia|carga|lorc|
magic-broom|Escoba mágica|magia||delapouite|
healing-shield|Escudo curativo|magia|protección,sanación|delapouite|
energy-shield|Escudo de energía|magia|barrera|lorc|
fire-shield|Escudo de fuego|magia|protección,llamas|lorc|
ice-shield|Escudo de hielo|magia|protección,escarcha|lorc|
bolt-shield|Escudo de rayo|magia|escudo,electricidad|lorc|
lightning-shield|Escudo de rayos|magia||lorc|
magic-shield|Escudo mágico|magia||lorc|
earth-spit|Escupitajo de tierra|magia|proyectil|lorc|
crumbling-ball|Esfera desmoronada|magia|bola|lorc|
beam-wake|Estela de rayo|magia|rayo,energía|lorc|
star-satellites|Estrella con satélites|magia|órbita|lorc|
wrapping-star|Estrella envolvente|magia||lorc|
dripping-star|Estrella goteante|magia|gotas|lorc|
crowned-explosion|Explosión coronada|magia|estallido|lorc|
magnet-blast|Explosión magnética|magia||lorc|
bubbling-flask|Frasco burbujeante|magia|poción,pócima|lorc|
heart-bottle|Frasco con corazón|magia|poción,amor|lorc|
fizzing-flask|Frasco efervescente|magia|poción,burbujas|lorc|
alien-fire|Fuego alienígena|magia|llama,extraterrestre|lorc|
frostfire|Fuego helado|magia|hielo,llamas|lorc|
cubeforce|Fuerza cúbica|magia|energía,cubo|lorc|
bolt-drop|Gota de rayo|magia|rayo,electricidad|delapouite|
gravitation|Gravitación|magia|atracción,órbita|delapouite|
lightning-shout|Grito eléctrico|magia||lorc|
magic-axe|Hacha mágica|magia||delapouite|
charm|Hechizo de encanto|magia|embrujo,amuleto|lorc|
lightning-helix|Hélice de rayos|magia||lorc|
heptagram|Heptagrama|magia|estrella,siete puntas|delapouite|
cosmic-egg|Huevo cósmico|magia|universo|delapouite|
body-swapping|Intercambio de cuerpos|magia|transformación,cambio|lorc|
invisible|Invisible|magia|invisibilidad,oculto|delapouite|
love-injection|Inyección de amor|magia||lorc|
fire-iris|Iris de fuego|magia|ojo,llamas|delapouite|
ice-iris|Iris de hielo|magia|ojo,escarcha|delapouite|
lightning-tear|Lágrima de rayo|magia||lorc|
magic-lamp|Lámpara mágica|magia|genio|lorc|
ice-spear|Lanza de hielo|magia|arma,escarcha|lorc|
fire-spell-cast|Lanzar hechizo de fuego|magia|conjuro,llamas|delapouite|
ice-spell-cast|Lanzar hechizo de hielo|magia|conjuro,escarcha|delapouite|
vine-whip|Látigo de vid|magia||lorc|
book-aura|Libro con aura|magia|libro,resplandor|lorc|
lightning-flame|Llama eléctrica|magia||delapouite|
hexes|Maleficios|magia|hechizos,maldición|skoll|
glowing-hands|Manos brillantes|magia|hechizo,energía|lorc|
burning-meteor|Meteoro en llamas|magia|meteorito,fuego|lorc|
voodoo-doll|Muñeco vudú|magia||lorc|
firewall|Muro de fuego|magia|llamas,barrera|delapouite|
poison-cloud|Nube venenosa|magia|gas,tóxico|sbed|
warlock-eye|Ojo de brujo|magia||delapouite|
crystal-eye|Ojo de cristal|magia|vidente|lorc|
bolt-eye|Ojo de rayo|magia|rayo,ojo|lorc|
burning-eye|Ojo en llamas|magia|ojo,fuego|lorc|
fire-wave|Ola de fuego|magia|llamas,oleada|lorc|
echo-ripples|Ondas de eco|magia|sonido|lorc|
psychic-waves|Ondas psíquicas|magia|mente,telepatía|lorc|
concentration-orb|Orbe de concentración|magia|esfera,enfoque|lorc|
orb-direction|Orbe de dirección|magia||lorc|
double-ringed-orb|Orbe de doble anillo|magia|esfera,planeta|lorc|
dragon-orb|Orbe de dragón|magia|esfera,dragón|delapouite|
extraction-orb|Orbe de extracción|magia|esfera,energía|lorc|
frozen-orb|Orbe helado|magia|esfera,hielo|lorc|
unstable-orb|Orbe inestable|magia||lorc|
magic-palm|Palma mágica|magia|mano|lorc|
wingfoot|Pie alado|magia||lorc|
winged-leg|Pierna alada|magia||lorc|
potion-of-madness|Poción de locura|magia|frasco,demencia|starseeker|
standing-potion|Poción de pie|magia|frasco|lorc|
health-potion|Poción de salud|magia|curación,frasco|delapouite|
magic-potion|Poción mágica|magia||delapouite|
round-potion|Poción redonda|magia|frasco|caro-asercion|
green-power|Poder verde|magia|energía,naturaleza|delapouite|
star-gate|Portal estelar|magia|puerta|delapouite|
prism|Prisma|magia|cristal,luz|delapouite|
unstable-projectile|Proyectil inestable|magia||lorc|
magic-gate|Puerta mágica|magia||lorc|
burning-dot|Punto ardiente|magia|fuego,chispa|lorc|
lightning-branches|Ramas de rayo|magia||lorc|
bubbling-beam|Rayo burbujeante|magia|burbujas,rayo|lorc|
ringed-beam|Rayo con anillos|magia|energía|lorc|
water-bolt|Rayo de agua|magia||lorc|
lightning-dissipation|Rayo disipado|magia||lorc|
bottled-bolt|Rayo embotellado|magia|rayo,botella|lorc|
arcing-bolt|Rayo en arco|magia|relámpago,electricidad|lorc|
chain-lightning|Rayo en cadena|magia|relámpago,electricidad|willdabeast|
sinusoidal-beam|Rayo sinusoidal|magia|onda|lorc|
sonic-lightning|Rayo sónico|magia|onda|lorc|
expanded-rays|Rayos expandidos|magia|luz,destello|lorc|
orbital-rays|Rayos orbitales|magia||lorc|
soul-vessel|Recipiente de almas|magia|vasija|delapouite|
regeneration|Regeneración|magia|curación|sbed|
focused-lightning|Relámpago concentrado|magia|rayo,electricidad|lorc|
resonance|Resonancia|magia|vibración|lorc|
pentagram-rose|Rosa pentagrama|magia||lorc|
silence|Silencio|magia|callar|lorc|
lightning-shadow|Sombra de rayo|magia||lorc|
bottled-shadow|Sombra embotellada|magia|sombra,botella|delapouite|
magic-hat|Sombrero mágico|magia||delapouite|
telefrag|Telefragmento|magia|teletransporte|sbed|
telepathy|Telepatía|magia|mente|lorc|
teleport|Teletransporte|magia||lorc|
backward-time|Tiempo atrás|magia|retroceder,reloj|delapouite|
daemon-pull|Tirón demoníaco|magia|demonio|delapouite|
whirlwind|Torbellino|magia||lorc|
brainstorm|Tormenta de ideas|magia|cerebro,rayo|lorc|
book-storm|Tormenta de libros|magia|libros,hojas|lorc|
pentarrows-tornado|Tornado de cinco flechas|magia||lorc|
tornado-discs|Tornado de discos|magia||lorc|
time-trap|Trampa temporal|magia||lorc|
transform|Transformación|magia||delapouite|
three-burning-balls|Tres bolas ardientes|magia|fuego|lorc|
triorb|Tres orbes|magia||lorc|
magic-trident|Tridente mágico|magia||delapouite|
lightning-trio|Trío de rayos|magia||lorc|
flame-tunnel|Túnel de llamas|magia|fuego,pasillo|lorc|
brain-dump|Vaciado mental|magia|cerebro,mente|delapouite|
icicles-fence|Valla de carámbanos|magia|hielo,barrera|lorc|
bottle-vapors|Vapores en botella|magia|botella,poción|lorc|
lunar-wand|Varita lunar|magia||delapouite|
vial|Vial|magia|frasco|sbed|
vortex|Vórtice|magia||lorc|
fire-zone|Zona de fuego|magia|área,llamas|lorc|
angel-wings|Alas de ángel|religion|alas,celestial|lorc|*
ankh|Anj|religion|egipcio,cruz de la vida|lorc|*
chalice-drops|Cáliz|religion|copa,gotas|lorc|*
hand-of-god|Destino|religion|mano,dios|delapouite|*
tombstone|Lápida|religion|tumba|lorc|*
death-skull|Muerte|religion|calavera,cráneo|sbed|*
eye-of-horus|Ojo|religion|horus,egipcio|delapouite|*
all-seeing-eye|Ojo que todo lo ve|religion|ojo,providencia|delapouite|*
holy-symbol|Símbolo sagrado|religion|sagrado,clérigo|lorc|*
pope-crown|Sumo sacerdote|religion|papa,corona|delapouite|*
third-eye|Tercer ojo|religion||lorc|*
holy-water|Agua bendita|religion|bendición,frasco|delapouite|
akhet|Akhet|religion|egipcio,horizonte|delapouite|
soul|Alma|religion|espíritu|delapouite|
sword-altar|Altar de espada|religion||delapouite|
star-altar|Altar de estrella|religion|estrella|delapouite|
anubis|Anubis|religion|dios egipcio,chacal|delapouite|
coffin|Ataúd|religion|féretro,muerte|lorc|
egyptian-bird|Ave egipcia|religion|ibis,jeroglífico|delapouite|
bastet|Bastet|religion|diosa egipcia,gato|delapouite|
totem-head|Cabeza de tótem|religion||lorc|
leaky-skull|Calavera con fugas|religion|muerte|lorc|
candle-skull|Calavera con vela|religion|calavera,vela|lorc|
calavera|Calavera mexicana|religion|muertos,cráneo|delapouite|
chewed-skull|Calavera mordida|religion|mordisco,muerte|lorc|
crook-flail|Cayado y mayal|religion|faraón,egipcio|delapouite|
templar-heart|Corazón templario|religion||lorc|
crown-of-thorns|Corona de espinas|religion|martirio|lorc|
hell-crosses|Cruces del infierno|religion|demonio,cruz|delapouite|
crucifix|Crucifijo|religion|cruz|delapouite|
jerusalem-cross|Cruz de Jerusalén|religion|cruzado,cruz|delapouite|
camargue-cross|Cruz de la Camarga|religion|cruz,ancla|delapouite|
gothic-cross|Cruz gótica|religion|cruz,cristiana|lorc|
dragon-head-faithtoken|Dragón de fe|religion|dragón,emblema|faithtoken|
shinto-shrine-mirror|Espejo sintoísta|religion|santuario|delapouite|
colombian-statue|Estatua precolombina|religion|ídolo,figura|delapouite|
stigmata|Estigmas|religion|herida|lorc|
grave-flowers|Flores de tumba|religion|ofrenda,cementerio|delapouite|
aspergillum|Hisopo|religion|agua bendita,aspersorio|delapouite|
horus|Horus|religion|dios,egipcio|delapouite|
crossed-bones|Huesos cruzados|religion|muerte,peligro|lorc|
enlightenment|Iluminación|religion|luz,sabiduría|lorc|
incense|Incienso|religion|ritual,aroma|lorc|
tombstone-sbed|Lápida con cruz|religion|tumba|sbed|
ceremonial-mask|Máscara ceremonial|religion|ritual,tribal|delapouite|
totem-mask|Máscara de tótem|religion||lorc|
moai|Moái|religion|estatua|delapouite|
martyr-memorial|Monumento al mártir|religion||delapouite|
ophanim|Ofanim|religion|ángel|caro-asercion|
templar-eye|Ojo templario|religion||lorc|
prayer|Oración|religion|rezar,manos|lorc|
djed-pillar|Pilar djed|religion|egipcio,osiris|delapouite|
pyre|Pira|religion|hoguera,funeral|delapouite|
heaven-gate|Puerta del cielo|religion|paraíso,cielo|delapouite|
prayer-beads|Rosario|religion|cuentas,oración|delapouite|
holy-grail|Santo Grial|religion|cáliz,reliquia|lorc|
crystal-shrine|Santuario de cristal|religion|altar|delapouite|
fire-shrine|Santuario de fuego|religion|altar,llamas|delapouite|
sarcophagus|Sarcófago|religion|tumba,momia|delapouite|
grim-reaper|Segador|religion|muerte,parca|lorc|
hades-symbol|Símbolo de Hades|religion|inframundo,dios|delapouite|
elysium-shade|Sombra del Elíseo|religion|espíritu,fantasma|delapouite|
temptation|Tentación|religion|manzana|lorc|
totem|Tótem|religion||delapouite|
snake-totem|Tótem de serpiente|religion|culto|lorc|
hasty-grave|Tumba improvisada|religion|sepultura,cruz|skoll|
pirate-grave|Tumba pirata|religion||lorc|
tumulus|Túmulo|religion|tumba|cathelineau|
rod-of-asclepius|Vara de Asclepio|religion|medicina,serpiente|delapouite|
venus-of-willendorf|Venus de Willendorf|religion|estatuilla|delapouite|
hearts|Afecto|simbolos|amor,corazones|skoll|*
shaking-hands|Alianza|simbolos|apretón de manos,pacto|delapouite|*
flag-objective|Bandera|simbolos|objetivo,meta|delapouite|*
black-flag|Bandera negra|simbolos|pirata,bandera|lorc|*
breaking-chain|Cadenas|simbolos|romper,libertad|skoll|*
skull-crossed-bones|Calavera|simbolos|huesos,pirata|lorc|*
chat-bubble|Conversación|simbolos|diálogo,mensaje|delapouite|*
broken-heart|Desamor|simbolos|corazón roto,pena|lorc|*
talk|Diálogo|simbolos||skoll|*
yin-yang|Equilibrio|simbolos|yin yang|delapouite|*
crossed-chains|Esclavitud|simbolos|cadenas,prisión|lorc|*
tattered-banner|Estandarte|simbolos|bandera|lorc|*
fleur-de-lys|Flor de lis|simbolos|heráldica,lirio|delapouite|*
griffin-symbol|Grifo|simbolos|heráldica,emblema|delapouite|*
check-mark|Hecho|simbolos|visto,correcto|delapouite|*
info|Información|simbolos|datos,ayuda|delapouite|*
scales|Justicia|simbolos|balanza|lorc|*
gavel|Ley|simbolos|mazo,juez|lorc|*
position-marker|Lugar|simbolos|ubicación,mapa|delapouite|*
hazard-sign|Peligro|simbolos|aviso,señal|lorc|*
help|Pregunta|simbolos|ayuda,interrogación|sbed|*
cancel|Prohibido|simbolos|cancelar,no|sbed|*
stars-stack|Rango|simbolos|estrellas|delapouite|*
skull-signet|Sello de calavera|simbolos|anillo|lorc|*
triquetra|Triqueta|simbolos||delapouite|*
laurels|Victoria|simbolos|laurel|lorc|*
on-sight|A la vista|simbolos||darkzaitzev|
abstract-001|Abstracto 001|simbolos|dibujo|viscious-speed|
abstract-002|Abstracto 002|simbolos|dibujo|viscious-speed|
abstract-003|Abstracto 003|simbolos|dibujo|viscious-speed|
abstract-004|Abstracto 004|simbolos|dibujo|viscious-speed|
abstract-005|Abstracto 005|simbolos|dibujo|viscious-speed|
abstract-006|Abstracto 006|simbolos|dibujo|viscious-speed|
abstract-007|Abstracto 007|simbolos|dibujo|viscious-speed|
abstract-008|Abstracto 008|simbolos|dibujo|viscious-speed|
abstract-009|Abstracto 009|simbolos|dibujo|viscious-speed|
abstract-010|Abstracto 010|simbolos|dibujo|viscious-speed|
abstract-011|Abstracto 011|simbolos|dibujo|viscious-speed|
abstract-012|Abstracto 012|simbolos|dibujo|viscious-speed|
abstract-013|Abstracto 013|simbolos|dibujo|viscious-speed|
abstract-014|Abstracto 014|simbolos|dibujo|viscious-speed|
abstract-015|Abstracto 015|simbolos|dibujo|viscious-speed|
abstract-016|Abstracto 016|simbolos|dibujo|viscious-speed|
abstract-017|Abstracto 017|simbolos|dibujo|viscious-speed|
abstract-018|Abstracto 018|simbolos|dibujo|viscious-speed|
abstract-019|Abstracto 019|simbolos|dibujo|viscious-speed|
abstract-020|Abstracto 020|simbolos|dibujo|viscious-speed|
abstract-021|Abstracto 021|simbolos|dibujo|viscious-speed|
abstract-022|Abstracto 022|simbolos|dibujo|viscious-speed|
abstract-023|Abstracto 023|simbolos|dibujo|viscious-speed|
abstract-024|Abstracto 024|simbolos|dibujo|viscious-speed|
abstract-025|Abstracto 025|simbolos|dibujo|viscious-speed|
abstract-026|Abstracto 026|simbolos|dibujo|viscious-speed|
abstract-027|Abstracto 027|simbolos|dibujo|viscious-speed|
abstract-028|Abstracto 028|simbolos|dibujo|viscious-speed|
abstract-029|Abstracto 029|simbolos|dibujo|viscious-speed|
abstract-030|Abstracto 030|simbolos|dibujo|viscious-speed|
abstract-031|Abstracto 031|simbolos|dibujo|viscious-speed|
abstract-032|Abstracto 032|simbolos|dibujo|viscious-speed|
abstract-033|Abstracto 033|simbolos|dibujo|viscious-speed|
abstract-034|Abstracto 034|simbolos|dibujo|viscious-speed|
abstract-035|Abstracto 035|simbolos|dibujo|viscious-speed|
abstract-036|Abstracto 036|simbolos|dibujo|viscious-speed|
abstract-037|Abstracto 037|simbolos|dibujo|viscious-speed|
abstract-038|Abstracto 038|simbolos|dibujo|viscious-speed|
abstract-039|Abstracto 039|simbolos|dibujo|viscious-speed|
abstract-040|Abstracto 040|simbolos|dibujo|viscious-speed|
abstract-041|Abstracto 041|simbolos|dibujo|viscious-speed|
abstract-042|Abstracto 042|simbolos|dibujo|viscious-speed|
abstract-043|Abstracto 043|simbolos|dibujo|viscious-speed|
abstract-044|Abstracto 044|simbolos|dibujo|viscious-speed|
abstract-045|Abstracto 045|simbolos|dibujo|viscious-speed|
abstract-046|Abstracto 046|simbolos|dibujo|viscious-speed|
abstract-047|Abstracto 047|simbolos|dibujo|viscious-speed|
abstract-048|Abstracto 048|simbolos|dibujo|viscious-speed|
abstract-049|Abstracto 049|simbolos|dibujo|viscious-speed|
abstract-050|Abstracto 050|simbolos|dibujo|viscious-speed|
abstract-051|Abstracto 051|simbolos|dibujo|viscious-speed|
abstract-052|Abstracto 052|simbolos|dibujo|viscious-speed|
abstract-053|Abstracto 053|simbolos|dibujo|viscious-speed|
abstract-054|Abstracto 054|simbolos|dibujo|viscious-speed|
abstract-055|Abstracto 055|simbolos|dibujo|viscious-speed|
abstract-056|Abstracto 056|simbolos|dibujo|viscious-speed|
abstract-057|Abstracto 057|simbolos|dibujo|viscious-speed|
abstract-058|Abstracto 058|simbolos|dibujo|viscious-speed|
abstract-059|Abstracto 059|simbolos|dibujo|viscious-speed|
abstract-060|Abstracto 060|simbolos|dibujo|viscious-speed|
abstract-061|Abstracto 061|simbolos|dibujo|viscious-speed|
abstract-062|Abstracto 062|simbolos|dibujo|viscious-speed|
abstract-063|Abstracto 063|simbolos|dibujo|viscious-speed|
abstract-064|Abstracto 064|simbolos|dibujo|viscious-speed|
abstract-065|Abstracto 065|simbolos|dibujo|viscious-speed|
abstract-066|Abstracto 066|simbolos|dibujo|viscious-speed|
abstract-067|Abstracto 067|simbolos|dibujo|viscious-speed|
abstract-068|Abstracto 068|simbolos|dibujo|viscious-speed|
abstract-069|Abstracto 069|simbolos|dibujo|viscious-speed|
abstract-070|Abstracto 070|simbolos|dibujo|viscious-speed|
abstract-071|Abstracto 071|simbolos|dibujo|viscious-speed|
abstract-072|Abstracto 072|simbolos|dibujo|viscious-speed|
abstract-073|Abstracto 073|simbolos|dibujo|viscious-speed|
abstract-074|Abstracto 074|simbolos|dibujo|viscious-speed|
abstract-075|Abstracto 075|simbolos|dibujo|viscious-speed|
abstract-076|Abstracto 076|simbolos|dibujo|viscious-speed|
abstract-077|Abstracto 077|simbolos|dibujo|viscious-speed|
abstract-078|Abstracto 078|simbolos|dibujo|viscious-speed|
abstract-079|Abstracto 079|simbolos|dibujo|viscious-speed|
abstract-080|Abstracto 080|simbolos|dibujo|viscious-speed|
abstract-081|Abstracto 081|simbolos|dibujo|viscious-speed|
abstract-082|Abstracto 082|simbolos|dibujo|viscious-speed|
abstract-083|Abstracto 083|simbolos|dibujo|viscious-speed|
abstract-084|Abstracto 084|simbolos|dibujo|viscious-speed|
abstract-085|Abstracto 085|simbolos|dibujo|viscious-speed|
abstract-086|Abstracto 086|simbolos|dibujo|viscious-speed|
abstract-087|Abstracto 087|simbolos|dibujo|viscious-speed|
abstract-088|Abstracto 088|simbolos|dibujo|viscious-speed|
abstract-089|Abstracto 089|simbolos|dibujo|viscious-speed|
abstract-090|Abstracto 090|simbolos|dibujo|viscious-speed|
abstract-091|Abstracto 091|simbolos|dibujo|viscious-speed|
abstract-092|Abstracto 092|simbolos|dibujo|viscious-speed|
abstract-093|Abstracto 093|simbolos|dibujo|viscious-speed|
abstract-094|Abstracto 094|simbolos|dibujo|viscious-speed|
abstract-095|Abstracto 095|simbolos|dibujo|viscious-speed|
abstract-096|Abstracto 096|simbolos|dibujo|viscious-speed|
abstract-097|Abstracto 097|simbolos|dibujo|viscious-speed|
abstract-098|Abstracto 098|simbolos|dibujo|viscious-speed|
abstract-099|Abstracto 099|simbolos|dibujo|viscious-speed|
abstract-100|Abstracto 100|simbolos|dibujo|viscious-speed|
abstract-101|Abstracto 101|simbolos|dibujo|viscious-speed|
abstract-102|Abstracto 102|simbolos|dibujo|viscious-speed|
abstract-103|Abstracto 103|simbolos|dibujo|viscious-speed|
abstract-104|Abstracto 104|simbolos|dibujo|viscious-speed|
abstract-105|Abstracto 105|simbolos|dibujo|viscious-speed|
abstract-106|Abstracto 106|simbolos|dibujo|viscious-speed|
abstract-107|Abstracto 107|simbolos|dibujo|viscious-speed|
abstract-108|Abstracto 108|simbolos|dibujo|viscious-speed|
abstract-109|Abstracto 109|simbolos|dibujo|viscious-speed|
abstract-110|Abstracto 110|simbolos|dibujo|viscious-speed|
abstract-111|Abstracto 111|simbolos|dibujo|viscious-speed|
abstract-112|Abstracto 112|simbolos|dibujo|viscious-speed|
abstract-113|Abstracto 113|simbolos|dibujo|viscious-speed|
abstract-114|Abstracto 114|simbolos|dibujo|viscious-speed|
abstract-115|Abstracto 115|simbolos|dibujo|viscious-speed|
abstract-116|Abstracto 116|simbolos|dibujo|viscious-speed|
abstract-117|Abstracto 117|simbolos|dibujo|viscious-speed|
abstract-118|Abstracto 118|simbolos|dibujo|viscious-speed|
abstract-119|Abstracto 119|simbolos|dibujo|viscious-speed|
abstract-120|Abstracto 120|simbolos|dibujo|viscious-speed|
abstract-121|Abstracto 121|simbolos|dibujo|viscious-speed|
aquarius|Acuario (signo)|simbolos|zodiaco,horóscopo|delapouite|
cuauhtli|Águila azteca|simbolos|cuauhtli,guerrero|delapouite|
liberty-wing|Ala de la libertad|simbolos||delapouite|
cheerful|Alegría|simbolos|contento,sonrisa|lorc|
speaker-off|Altavoz apagado|simbolos|silencio|delapouite|
halt|Alto|simbolos|parar,mano|skoll|
eternal-love|Amor eterno|simbolos|corazón,infinito|delapouite|
evil-love|Amor maligno|simbolos|corazón|delapouite|
self-love|Amor propio|simbolos|corazón|lorc|
royal-love|Amor real|simbolos|corazón,corona|lorc|
anarchy|Anarquía|simbolos|símbolo,caos|delapouite|
annexation|Anexión|simbolos|conquista,territorio|cathelineau|
angola|Angola|simbolos|país,bandera|delapouite|
linked-rings|Anillos enlazados|simbolos||lorc|
perpendicular-rings|Anillos perpendiculares|simbolos||lorc|
player-previous|Anterior|simbolos|retroceder|delapouite|
checkbox-tree|Árbol de casillas|simbolos|lista,jerarquía|lorc|
family-tree|Árbol genealógico|simbolos|linaje,familia|delapouite|
algeria|Argelia|simbolos|país,bandera|delapouite|
aries|Aries|simbolos|zodiaco,carnero|delapouite|
arrest|Arresto|simbolos|detención,esposas|delapouite|
brazil-flag|Bandera de Brasil|simbolos|país,bandera|delapouite|
tusks-flag|Bandera de colmillos|simbolos||delapouite|
checkered-flag|Bandera de cuadros|simbolos|meta,carrera|delapouite|
usa-flag|Bandera de EE. UU.|simbolos||delapouite|
star-flag|Bandera de estrella|simbolos|estandarte|delapouite|
level-end-flag|Bandera de meta|simbolos|final|delapouite|
south-africa-flag|Bandera de Sudáfrica|simbolos|país|delapouite|
european-flag|Bandera europea|simbolos|unión europea|delapouite|
flying-flag|Bandera ondeando|simbolos|estandarte,pendón|lorc|
pirate-flag|Bandera pirata|simbolos||delapouite|
life-bar|Barra de vida|simbolos|salud|delapouite|
black-bar|Barra negra|simbolos|censura,línea|lorc|
belgium|Bélgica|simbolos|país,bandera|delapouite|
ascending-block|Bloque ascendente|simbolos|subir,cubo|delapouite|
thought-bubble|Bocadillo de pensamiento|simbolos||seregacthtuf|
ball-heart|Bola con corazón|simbolos|corazón,esfera|lorc|
blackball|Bola negra|simbolos|votación,rechazo|lorc|
bolivia|Bolivia|simbolos|país,bandera|delapouite|
previous-button|Botón anterior|simbolos|retroceder|delapouite|
fast-forward-button|Botón de avance rápido|simbolos|adelantar,siguiente|delapouite|
pause-button|Botón de pausa|simbolos||guard13007|
play-button|Botón de reproducir|simbolos|play|guard13007|
fast-backward-button|Botón de retroceso rápido|simbolos|rebobinar,atrás|delapouite|
next-button|Botón siguiente|simbolos||delapouite|
brazil|Brasil|simbolos|país,mapa|delapouite|
bulgaria|Bulgaria|simbolos|país,bandera|delapouite|
trojan-horse|Caballo de Troya|simbolos||delapouite|
andromeda-chain|Cadena de Andrómeda|simbolos|constelación,cadena|lorc|
caduceus|Caduceo|simbolos|hermes,medicina|delapouite|
star-skull|Calavera con estrella|simbolos||lorc|
harry-potter-skull|Calavera con rayo en la frente|simbolos|cicatriz,mago|lorc|
happy-skull|Calavera feliz|simbolos|cráneo,sonrisa|lorc|
pirate-skull|Calavera pirata|simbolos||lorc|
aztec-calendar-sun|Calendario azteca|simbolos|sol,piedra del sol|delapouite|
resize|Cambiar tamaño|simbolos|redimensionar|delapouite|
cambodia|Camboya|simbolos|país,bandera|delapouite|
walk|Caminar|simbolos||delapouite|
cancer|Cáncer|simbolos|zodiaco,cangrejo|delapouite|
capricorn|Capricornio|simbolos|zodiaco,cabra|delapouite|
load|Cargar arma|simbolos||delapouite|
cherish|Cariño|simbolos|amor,abrazo|delapouite|
conversation|Charla|simbolos|diálogo,hablar|lorc|
cycle|Ciclo|simbolos|flechas,repetir|lorc|
star-cycle|Ciclo de estrellas|simbolos|estrellas|lorc|
broken-ribbon|Cinta rota|simbolos|lazo,roto|lorc|
circle|Círculo|simbolos|aro|delapouite|
circle-claws|Círculo de garras|simbolos|zarpas|lorc|
plain-circle|Círculo liso|simbolos||delapouite|
click|Clic|simbolos|ratón,puntero|skoll|
share|Compartir|simbolos|enviar|delapouite|
confirmed|Confirmado|simbolos|aceptar,visto|delapouite|
behold|Contemplar|simbolos|ojo,mirar|lorc|
convince|Convencer|simbolos|persuadir,discurso|delapouite|
heart-wings|Corazón alado|simbolos|amor,alas|delapouite|
locked-heart|Corazón cerrado|simbolos|amor|delapouite|
crowned-heart|Corazón coronado|simbolos|amor,realeza|lorc|
chained-heart|Corazón encadenado|simbolos|cadenas,amor|lorc|
shattered-heart|Corazón roto|simbolos|desamor|delapouite|
nested-hearts|Corazones anidados|simbolos||delapouite|
opposite-hearts|Corazones opuestos|simbolos||delapouite|
south-korea|Corea del Sur|simbolos|país|delapouite|
crenel-crown|Corona almenada|simbolos|almenas,torre|delapouite|
balkenkreuz|Cruz de brazos rectos|simbolos|cruz,emblema|skoll|
iron-cross|Cruz de hierro|simbolos|condecoración,cruz|skoll|
hospital-cross|Cruz de hospital|simbolos|medicina,sanidad|lorc|
cross-mark|Cruz marcada|simbolos|aspa,error|lorc|
split-cross|Cruz partida|simbolos|dividida|lorc|
square|Cuadrado|simbolos|forma|delapouite|
divided-square|Cuadrado dividido|simbolos|división|skoll|
plain-square|Cuadrado liso|simbolos||delapouite|
cube|Cubo|simbolos|figura|delapouite|
cubes|Cubos|simbolos|bloques|lorc|
arrow-cursor|Cursor de flecha|simbolos|puntero,interfaz|delapouite|
delighted|Deleite|simbolos|alegría,cara|lorc|
unbalanced|Desequilibrio|simbolos||delapouite|
despair|Desesperación|simbolos|angustia,tristeza|lorc|
detour|Desvío|simbolos|rodeo,flecha|delapouite|
convergence-target|Diana convergente|simbolos|objetivo,flechas|delapouite|
police-target|Diana de policía|simbolos|blanco,objetivo|delapouite|
disc|Disco|simbolos|círculo|lorc|
discussion|Discusión|simbolos|debate,diálogo|delapouite|
path-distance|Distancia del camino|simbolos||delapouite|
divergence|Divergencia|simbolos|flechas,separar|lorc|
two-shadows|Dos sombras|simbolos||lorc|
duality|Dualidad|simbolos|yin yang,opuestos|lorc|
doubled|Duplicado|simbolos|doble,copia|sbed|
duration|Duración|simbolos|tiempo,reloj|delapouite|
diamond-hard|Dureza de diamante|simbolos|gema,resistente|lorc|
dwennimmen|Dwennimmen|simbolos|adinkra,carneros|delapouite|
nested-eclipses|Eclipses anidados|simbolos||lorc|
ages|Edades|simbolos|tiempo,épocas|delapouite|
choice|Elección|simbolos|decisión,bifurcación|delapouite|
winged-emblem|Emblema alado|simbolos||lorc|
eagle-emblem|Emblema de águila|simbolos|heráldica|lorc|
batwing-emblem|Emblema de ala de murciélago|simbolos|murciélago,emblema|lorc|
steelwing-emblem|Emblema de alas de acero|simbolos||lorc|
condor-emblem|Emblema de cóndor|simbolos|ave,heráldica|lorc|
swords-emblem|Emblema de espadas|simbolos||lorc|
hawk-emblem|Emblema de halcón|simbolos|ave,heráldica|lorc|
flower-emblem|Emblema floral|simbolos|flor,escudo|delapouite|
boar-ensign|Enseña de jabalí|simbolos|estandarte,jabalí|cathelineau|
radial-balance|Equilibrio radial|simbolos|simetría|lorc|
team-upgrade|Equipo en alza|simbolos||delapouite|
team-downgrade|Equipo en baja|simbolos||delapouite|
scorpio|Escorpio|simbolos|zodiaco|delapouite|
ribbon-shield|Escudo con cinta|simbolos|emblema|delapouite|
black-hand-shield|Escudo de mano negra|simbolos|mano,escudo|lorc|
rosa-shield|Escudo de rosa|simbolos|emblema|lorc|
shield-disabled|Escudo desactivado|simbolos|sin defensa|skoll|
shield-opposition|Escudos enfrentados|simbolos|conflicto|delapouite|
spain|España|simbolos|país|delapouite|
oily-spiral|Espiral aceitosa|simbolos||lorc|
divided-spiral|Espiral dividida|simbolos|remolino|lorc|
coiling-curl|Espiral enroscada|simbolos|rizo,voluta|lorc|
vertical-banner|Estandarte vertical|simbolos||delapouite|
allied-star|Estrella aliada|simbolos|militar,estrella|skoll|
rainbow-star|Estrella arcoíris|simbolos|colores|lorc|
beveled-star|Estrella biselada|simbolos|estrella|lorc|
barbed-star|Estrella con púas|simbolos|estrella,pinchos|lorc|
justice-star|Estrella de la justicia|simbolos|sheriff,placa|lorc|
law-star|Estrella de la ley|simbolos|sheriff|lorc|
moebius-star|Estrella de Möbius|simbolos||lorc|
seven-pointed-star|Estrella de siete puntas|simbolos|heptagrama|delapouite|
flexible-star|Estrella flexible|simbolos|estrella,adorno|lorc|
flat-star|Estrella plana|simbolos|estrella|lorc|
round-star|Estrella redonda|simbolos|astro|delapouite|
expand|Expandir|simbolos|ampliar,agrandar|delapouite|
bottom-right-3d-arrow|Flecha 3D abajo a la derecha|simbolos|flecha,dirección|lorc|
middle-arrow|Flecha central|simbolos||lorc|
arrow-wings|Flecha con alas|simbolos|veloz,rapidez|delapouite|
save-arrow|Flecha de guardar|simbolos|disquete|delapouite|
return-arrow|Flecha de retorno|simbolos|volver|lorc|
rapidshare-arrow|Flecha en círculo|simbolos|compartir|lorc|
spiral-arrow|Flecha en espiral|simbolos|giro|lorc|
tron-arrow|Flecha Tron|simbolos||lorc|
split-arrows|Flechas divididas|simbolos|bifurcación|delapouite|
interleaved-arrows|Flechas entrelazadas|simbolos|flechas,intercambio|lorc|
imbricated-arrows|Flechas superpuestas|simbolos|flechas,capas|lorc|
france|Francia|simbolos|país,mapa|delapouite|
air-force|Fuerza aérea|simbolos|ala,militar|skoll|
gemini|Géminis|simbolos|zodiaco,gemelos|delapouite|
anticlockwise-rotation|Giro antihorario|simbolos|flecha,rotación|delapouite|
clockwise-rotation|Giro horario|simbolos|rotación,flecha|delapouite|
pie-chart|Gráfico circular|simbolos||delapouite|
save|Guardar|simbolos|disquete|delapouite|
guatemala|Guatemala|simbolos|país,bandera|delapouite|
gluttony|Gula|simbolos|pecado,comida|lorc|
skills|Habilidades|simbolos|talentos|delapouite|
spiked-halo|Halo de púas|simbolos|aureola|lorc|
nested-hexagons|Hexágonos anidados|simbolos||delapouite|
hammer-sickle|Hoz y martillo|simbolos|comunismo,emblema|delapouite|
boot-prints|Huellas de botas|simbolos|pisadas,rastro|lorc|
morbid-humour|Humor negro|simbolos||lorc|
hungary|Hungría|simbolos|país,bandera|delapouite|
back-forth|Ida y vuelta|simbolos|flechas,alternar|lorc|
idea|Idea|simbolos|bombilla,inspiración|delapouite|
team-idea|Idea de equipo|simbolos||delapouite|
uncertainty|Incertidumbre|simbolos||lorc|
infinity|Infinito|simbolos|eterno,ocho|various-artists|
clout|Influencia|simbolos|poder,golpe|lorc|
injustice|Injusticia|simbolos|balanza rota,ley|delapouite|
inspiration|Inspiración|simbolos|idea,musa|delapouite|
toggles|Interruptores|simbolos||delapouite|
iraq|Irak|simbolos|país,mapa|delapouite|
italia|Italia|simbolos|país,mapa|delapouite|
japan|Japón|simbolos|país,mapa|delapouite|
kenya|Kenia|simbolos|bandera,país|delapouite|
klingon|Klingon|simbolos||delapouite|
lambda|Lambda|simbolos|letra|delapouite|
leo|Leo|simbolos|zodiaco|delapouite|
latvia|Letonia|simbolos|bandera,país|delapouite|
uprising|Levantamiento|simbolos|rebelión|delapouite|
libya|Libia|simbolos|bandera,país|delapouite|
libra|Libra|simbolos|zodiaco|delapouite|
finish-line|Línea de meta|simbolos|llegada,carrera|delapouite|
smart|Listo|simbolos|inteligencia|delapouite|
achievement|Logro|simbolos|trofeo,medalla|skoll|
concentric-crescents|Lunas concéntricas|simbolos|creciente|lorc|
tally-mark-5|Marcas de cuenta|simbolos||delapouite|
over-infinity|Más allá del infinito|simbolos||lorc|
freemasonry|Masonería|simbolos|escuadra,compás|delapouite|
medal-skull|Medalla de calavera|simbolos||lorc|
attack-gauge|Medidor de ataque|simbolos|indicador,ataque|delapouite|
upgrade|Mejora|simbolos||delapouite|
hamburger-menu|Menú hamburguesa|simbolos|interfaz,menú|delapouite|
stairs-goal|Meta en escaleras|simbolos|objetivo|delapouite|
mexico|México|simbolos|bandera,país|delapouite|
mighty-boosh|Mighty Boosh|simbolos||delapouite|
crosshair|Mira|simbolos|punto de mira,objetivo|delapouite|
james-bond-aperture|Mira de agente secreto|simbolos|espía,cañón|lorc|
look-at|Mirar|simbolos|ojo|delapouite|
love-mystery|Misterio de amor|simbolos||delapouite|
moldova|Moldavia|simbolos|bandera,país|delapouite|
mongolia|Mongolia|simbolos|bandera,país|delapouite|
move|Mover|simbolos||delapouite|
nigeria|Nigeria|simbolos|bandera,país|delapouite|
level-four|Nivel cuatro|simbolos|rango|sbed|
level-four-advanced|Nivel cuatro avanzado|simbolos|rango|sbed|
level-two|Nivel dos|simbolos|rango|sbed|
level-two-advanced|Nivel dos avanzado|simbolos|rango|sbed|
level-three|Nivel tres|simbolos|rango|sbed|
level-three-advanced|Nivel tres avanzado|simbolos|rango|sbed|
bowen-knot|Nudo de Bowen|simbolos|nudo,heráldica|delapouite|
triangle-target|Objetivo triangular|simbolos||delapouite|
hidden|Oculto|simbolos|escondido,sigilo|lorc|
occupy|Ocupar|simbolos||cathelineau|
ophiuchus|Ofiuco|simbolos|zodiaco|delapouite|
octogonal-eye|Ojo octogonal|simbolos||lorc|
sheikah-eye|Ojo sheikah|simbolos|zelda|lorc|
omega|Omega|simbolos|letra|lorc|
shiny-omega|Omega brillante|simbolos|letra|lorc|
sound-waves|Ondas de sonido|simbolos|audio|skoll|
oppression|Opresión|simbolos||lorc|
organigram|Organigrama|simbolos||delapouite|
bus-stop|Parada de autobús|simbolos|bus,señal|caro-asercion|
paraguay|Paraguay|simbolos|bandera,país|delapouite|
paranoia|Paranoia|simbolos||lorc|
burning-passion|Pasión ardiente|simbolos|corazón,fuego|lorc|
dread|Pavor|simbolos|miedo,terror|cathelineau|
think|Pensar|simbolos||delapouite|
peru|Perú|simbolos|bandera,país|delapouite|
tread|Pisada|simbolos||lorc|
pisces|Piscis|simbolos|zodiaco|delapouite|
police-badge|Placa de policía|simbolos|insignia,alguacil|andymeneely|
poland|Polonia|simbolos|país,bandera|delapouite|
portugal|Portugal|simbolos|país,bandera|delapouite|
progression|Progresión|simbolos|avance,subida|delapouite|
interdiction|Prohibición|simbolos|veto,prohibido|lorc|
thumb-down|Pulgar abajo|simbolos||delapouite|
thumb-up|Pulgar arriba|simbolos||delapouite|
rank-1|Rango 1|simbolos|galón,nivel|skoll|
rank-2|Rango 2|simbolos|galón,nivel|skoll|
rank-3|Rango 3|simbolos|galón,nivel|skoll|
recycle|Reciclaje|simbolos|reciclar|lorc|
revolt|Revuelta|simbolos|rebelión,puño|darkzaitzev|
revolt-sbed|Revuelta con puño|simbolos|rebelión|sbed|
biohazard|Riesgo biológico|simbolos|peligro,toxico|lorc|
checkered-diamond|Rombo ajedrezado|simbolos|damero|lorc|
gun-rose|Rosa con pistola|simbolos|arma,flor|delapouite|
rub-el-hizb|Rub el Hizb|simbolos|islámico,estrella|delapouite|
wisdom|Sabiduría|simbolos||delapouite|
sagittarius|Sagitario|simbolos|zodiaco|delapouite|
sergeant|Sargento|simbolos|rango,galón|delapouite|
select|Seleccionar|simbolos|cursor|sbed|
traffic-lights-ready-to-go|Semáforo listo|simbolos||delapouite|
traffic-lights-orange|Semáforo naranja|simbolos||delapouite|
traffic-lights-red|Semáforo rojo|simbolos||delapouite|
traffic-lights-green|Semáforo verde|simbolos||delapouite|
aerial-signal|Señal aérea|simbolos|bengala,aviso|lorc|
distress-signal|Señal de socorro|simbolos|bengala,auxilio|delapouite|
stop-sign|Señal de stop|simbolos||delapouite|
player-next|Siguiente|simbolos|avanzar|delapouite|
mute|Silenciar|simbolos||delapouite|
chalk-outline-murder|Silueta de tiza|simbolos|crimen,asesinato|delapouite|
female|Símbolo femenino|simbolos|mujer,género|delapouite|
nothing-to-say|Sin nada que decir|simbolos||lorc|
barbed-sun|Sol con púas|simbolos|sol,pinchos|lorc|
ubisoft-sun|Sol de Ubisoft|simbolos||lorc|
heraldic-sun|Sol heráldico|simbolos|emblema,escudo|caro-asercion|
striped-sun|Sol rayado|simbolos||delapouite|
private-first-class|Soldado de primera|simbolos|rango,galón|delapouite|
private|Soldado raso|simbolos|rango,galón|delapouite|
sound-on|Sonido activado|simbolos|volumen|delapouite|
sound-off|Sonido apagado|simbolos|silencio|delapouite|
gluttonous-smile|Sonrisa glotona|simbolos|gula,boca|lorc|
sri-lanka|Sri Lanka|simbolos|país|delapouite|
south-africa|Sudáfrica|simbolos|país|delapouite|
switzerland|Suiza|simbolos|bandera|delapouite|
hot-surface|Superficie caliente|simbolos|calor,peligro|sbed|
tanzania|Tanzania|simbolos|bandera|delapouite|
taurus|Tauro|simbolos|zodiaco|delapouite|
texas|Texas|simbolos||delapouite|
player-time|Tiempo de jugador|simbolos|reloj,turno|delapouite|
extra-time|Tiempo extra|simbolos|reloj,prórroga|delapouite|
all-for-one|Todos para uno|simbolos|unión,espadas|lorc|
moebius-trefoil|Trébol de Möbius|simbolos||lorc|
clover-spiked|Trébol de puntas|simbolos|suerte,pinchos|sbed|
fluffy-trefoil|Trébol esponjoso|simbolos|nube,trébol|lorc|
truce|Tregua|simbolos|paz|delapouite|
moebius-triangle|Triángulo de Möbius|simbolos||lorc|
triforce|Trifuerza|simbolos||delapouite|
trinacria|Trinacria|simbolos||delapouite|
triple-yin|Triple yin|simbolos||lorc|
light-thorny-triskelion|Triskel espinoso fino|simbolos||lorc|
heavy-thorny-triskelion|Triskel espinoso grueso|simbolos|espinas,celta|lorc|
tunisia|Túnez|simbolos|bandera|delapouite|
union-jack|Union Jack|simbolos|bandera|delapouite|
join|Unir|simbolos|conectar,juntar|delapouite|
ouroboros|Uróboros|simbolos|serpiente|lorc|
uruguay|Uruguay|simbolos|bandera|delapouite|
usable|Utilizable|simbolos||sbed|
multi-directions|Varias direcciones|simbolos||delapouite|
venezuela|Venezuela|simbolos|bandera|delapouite|
life-in-the-balance|Vida en juego|simbolos|balanza|lorc|
relationship-bounds|Vínculos|simbolos|relación,lazos|lorc|
virgo|Virgo|simbolos|zodiaco|delapouite|
horizontal-flip|Voltear horizontal|simbolos|reflejo,espejo|delapouite|
vertical-flip|Volteo vertical|simbolos||delapouite|
vote|Voto|simbolos||delapouite|
broken-heart-zone|Zona de corazón roto|simbolos|corazón roto,pena|lorc|
death-zone|Zona de muerte|simbolos|peligro|lorc|
anchor|Ancla|transporte|barco,marinero|lorc|*
galleon|Galeón|transporte|barco,velero|lorc|*
mine-wagon|Mina|transporte|vagoneta|delapouite|*
sailboat|Velero|transporte|barco|delapouite|*
battleship|Acorazado|transporte|barco,buque de guerra|cathelineau|
plane-wing|Ala de avión|transporte||delapouite|
hang-glider|Ala delta|transporte|vuelo,planeador|delapouite|
ambulance|Ambulancia|transporte|vehículo,médico|delapouite|
military-ambulance|Ambulancia militar|transporte||quoting|
steamroller|Apisonadora|transporte||caro-asercion|
car-seat|Asiento de coche|transporte|automóvil|delapouite|
bus|Autobús|transporte|vehículo,bus|delapouite|
airplane|Avión|transporte|aeronave,vuelo|skoll|
commercial-airplane|Avión comercial|transporte|aeronave|delapouite|
raft|Balsa|transporte|barca|delapouite|
small-fishing-sailboat|Barca de pesca|transporte|velero|pierre-leducq|
iron-hulled-warship|Barco de casco de hierro|transporte|barco,buque de guerra|cathelineau|
boat-horizon|Barco en el horizonte|transporte|barco,mar|delapouite|
sinking-ship|Barco hundiéndose|transporte|naufragio|delapouite|
fishing-boat|Barco pesquero|transporte|barca,pesca|delapouite|
dutch-bike|Bicicleta holandesa|transporte|bici|delapouite|
biplane|Biplano|transporte|avión,aeronave|quoting|
apc|Blindado|transporte|vehículo militar,transporte de tropas|skoll|
bomber|Bombardero|transporte|avión,bombas|lord-berandas|
stealth-bomber|Bombardero furtivo|transporte|avión|delapouite|
bulldozer|Bulldozer|transporte|excavadora,máquina|delapouite|
cargo-ship|Buque de carga|transporte|barco,mercante|delapouite|
dreadnought|Buque de guerra|transporte|barco,nave|cathelineau|
rail-road|Camino de raíles|transporte|vía,ferrocarril|delapouite|
truck|Camión|transporte||delapouite|
flatbed-covered|Camión con lona|transporte|camión,carga|skoll|
food-truck|Camión de comida|transporte|comida,puesto|delapouite|
flatbed|Camión de plataforma|transporte|camión,carga|skoll|
mine-truck|Camión minero|transporte||delapouite|
canoe|Canoa|transporte|piragua,remo|delapouite|
wood-canoe|Canoa de madera|transporte||delapouite|
apollo-capsule|Cápsula Apolo|transporte|nave espacial,astronauta|delapouite|
caravel|Carabela|transporte|barco,velero|delapouite|
caravan|Caravana|transporte|carromato,remolque|delapouite|
forklift|Carretilla elevadora|transporte|almacén,carga|delapouite|
chariot|Carro de guerra|transporte|cuadriga,biga|cathelineau|
old-wagon|Carro viejo|transporte||delapouite|
jet-fighter|Caza a reacción|transporte|avión,aeronave|delapouite|
light-fighter|Caza ligero|transporte|nave|lord-berandas|
race-car|Coche de carreras|transporte|bólido|skoll|
police-car|Coche de policía|transporte|patrulla|delapouite|
crow-nest|Cofa|transporte|barco,vigía|delapouite|
helicopter-tail|Cola de helicóptero|transporte|aeronave,rotor|delapouite|
cruiser|Crucero|transporte|barco,nave|cathelineau|
drakkar|Drakkar|transporte|barco vikingo|delapouite|
drakkar-dragon|Drakkar con dragón|transporte|barco vikingo|delapouite|
railway|Ferrocarril|transporte|vías,tren|delapouite|
f1-car|Fórmula 1|transporte|fórmula 1,bólido|skoll|
surfer-van|Furgoneta de surfista|transporte||delapouite|
galley|Galera|transporte|barco,remos|delapouite|
air-balloon|Globo aerostático|transporte|globo,aire|delapouite|
shooner-sailboat|Goleta|transporte|velero|pierre-leducq|
tow-truck|Grúa|transporte||delapouite|
cargo-crane|Grúa de carga|transporte|puerto|lorc|
boat-propeller|Hélice de barco|transporte|hélice,barco|delapouite|
helicopter|Helicóptero|transporte|aeronave,aspas|delapouite|
tire-tracks|Huellas de neumático|transporte||delapouite|
jeep|Jeep|transporte|todoterreno,coche|delapouite|
speed-boat|Lancha rápida|transporte|barco|delapouite|
airplane-arrival|Llegada de avión|transporte|aterrizaje,aeropuerto|delapouite|
steam-locomotive|Locomotora de vapor|transporte|tren|delapouite|
skid-mark|Marca de derrape|transporte|neumático|lorc|
figurehead|Mascarón de proa|transporte|barco,proa|delapouite|
subway|Metro|transporte||delapouite|
mini-submarine|Minisubmarino|transporte||delapouite|
unicycle|Monociclo|transporte||delapouite|
skateboard|Monopatín|transporte|skate|delapouite|
aero-bike|Moto aérea|transporte|vehículo,volador|delapouite|
boat-engine|Motor de barco|transporte|motor fueraborda,barco|delapouite|
ship-wreck|Naufragio|transporte|barco hundido|delapouite|
interceptor-ship|Nave interceptora|transporte|nave espacial,caza|delapouite|
tyre|Neumático|transporte|rueda|lorc|
mooring-bollard|Noray|transporte|puerto|delapouite|
tank-tread|Oruga de tanque|transporte||skoll|
parachute|Paracaídas|transporte||lorc|
hang-glider-skoll|Parapente|transporte|vuelo,planeador|skoll|
level-crossing|Paso a nivel|transporte|tren|delapouite|
scooter|Patinete|transporte|moto|delapouite|
kick-scooter|Patinete de niño|transporte||delapouite|
boat-fishing|Pesca en barca|transporte|barco,pescador|delapouite|
glider|Planeador|transporte|aeronave,vuelo|skoll|
carrier|Portaaviones|transporte|barco,nave|cathelineau|
ship-bow|Proa de barco|transporte|navío|delapouite|
car-door|Puerta de coche|transporte|automóvil|delapouite|
bus-doors|Puertas de autobús|transporte|bus,puertas|delapouite|
paddles|Remos|transporte||delapouite|
car-wheel|Rueda de coche|transporte|neumático|delapouite|
stone-wheel|Rueda de piedra|transporte||delapouite|
flat-tire|Rueda pinchada|transporte|neumático,pinchazo|delapouite|
airplane-departure|Salida de avión|transporte|despegue,aeropuerto|delapouite|
life-buoy|Salvavidas|transporte|flotador|delapouite|
saddle|Silla de montar|transporte|montura|delapouite|
sinagot|Sinagot|transporte|barco|delapouite|
submarine|Submarino|transporte||delapouite|
tank|Tanque|transporte|carro de combate|lorc|
battle-tank|Tanque de combate|transporte|carro blindado,tanque|lorc|
great-war-tank|Tanque de la Gran Guerra|transporte|carro de combate,blindado|cathelineau|
deathcab|Taxi de la muerte|transporte|coche|lorc|
ropeway|Teleférico|transporte|cable|delapouite|
ship-wheel|Timón de barco|transporte|barco|delapouite|
jeep-skoll|Todoterreno|transporte|todoterreno,coche|skoll|
farm-tractor|Tractor|transporte|granja,vehículo|delapouite|
subway-train|Tren de metro|transporte||caro-asercion|
trireme|Trirreme|transporte|barco|delapouite|
city-car|Utilitario|transporte|coche,automóvil|delapouite|
coal-wagon|Vagoneta de carbón|transporte|mina|delapouite|
paddle-steamer|Vapor de ruedas|transporte|barco|delapouite|
sail|Vela de barco|transporte|barco|delapouite|
velocipede|Velocípedo|transporte|bicicleta|delapouite|
steering-wheel|Volante|transporte|volante|delapouite|
zeppelin|Zepelín|transporte|dirigible|skoll|
chest|Cofre|dinero|baúl,tesoro|delapouite|*
two-coins|Dos monedas|dinero||delapouite|*
gems|Gemas|dinero|joyas,piedras preciosas|lorc|*
medal|Medalla|dinero|premio|lorc|*
crown-coin|Moneda real|dinero|corona|lorc|*
coins|Monedas|dinero|dinero|delapouite|*
money-stack|Riqueza|dinero|billetes|delapouite|*
open-treasure-chest|Tesoro|dinero|cofre|skoll|*
amethyst|Amatista|dinero|gema,piedra|skoll|
big-diamond-ring|Anillo de diamante|dinero|joya,anillo|skoll|
profit|Beneficio|dinero|ganancia|lorc|
banknote|Billete|dinero|papel moneda|delapouite|
cash|Billetes|dinero|dinero,efectivo|lorc|
shiny-purse|Bolsa brillante|dinero|monedero|lorc|
gem-chain|Cadena de gemas|dinero|joya,collar|lorc|
strongbox|Caja fuerte|dinero||delapouite|
wallet|Cartera|dinero||delapouite|
open-chest|Cofre abierto|dinero||skoll|
locked-chest|Cofre cerrado|dinero||lorc|
emerald-necklace|Collar de esmeraldas|dinero|joya|delapouite|
trade|Comercio|dinero|intercambio|lorc|
gold-shell|Concha de oro|dinero|molusco,tesoro|lorc|
credits-currency|Créditos|dinero|moneda,ciencia ficción|delapouite|
cut-diamond|Diamante tallado|dinero|gema,joya|lorc|
gold-scarab|Escarabajo de oro|dinero|escarabajo,egipcio|lorc|
emerald|Esmeralda|dinero|gema|lorc|
price-tag|Etiqueta de precio|dinero|precio,coste|delapouite|
expense|Gasto|dinero|coste,pago|delapouite|
fire-gem|Gema de fuego|dinero|joya,rubí|delapouite|
piggy-bank|Hucha|dinero|cerdito|delapouite|
gold-bar|Lingote de oro|dinero|oro,tesoro|willdabeast|
coins-pile|Montón de monedas|dinero|tesoro|delapouite|
gold-stack|Montón de oro|dinero|monedas,tesoro|delapouite|
pay-money|Pagar dinero|dinero||delapouite|
gold-nuggets|Pepitas de oro|dinero|oro,mineral|delapouite|
oyster-pearl|Perla de ostra|dinero||delapouite|
mineral-pearls|Perlas minerales|dinero||delapouite|
receive-money|Recibir dinero|dinero|cobrar|delapouite|
rupee|Rupia|dinero|moneda|delapouite|
diamonds-smile|Sonrisa de diamantes|dinero|dientes,gemas|lorc|
take-my-money|Toma mi dinero|dinero||delapouite|
topaz|Topacio|dinero|gema|skoll|
diamond-trophy|Trofeo de diamante|dinero|premio,gema|delapouite|
laurels-trophy|Trofeo de laurel|dinero|premio|delapouite|
sell-card|Vender carta|dinero|comercio|delapouite|
saphir|Zafiro|dinero|gema|lorc|
calendar|Calendario|documentos|fecha,almanaque|delapouite|*
book-cover|Libro|documentos|tapa,tomo|lorc|*
open-book|Libro abierto|documentos||lorc|*
treasure-map|Mapa del tesoro|documentos||lorc|*
scroll-unfurled|Pergamino|documentos|rollo|lorc|*
tied-scroll|Pergamino atado|documentos||lorc|*
feather|Pluma|documentos|ave,escribir|lorc|*
scroll-quill|Pluma y pergamino|documentos|escribir|delapouite|*
wanted-reward|Se busca|documentos|cartel,recompensa|delapouite|*
secret-book|Secreto|documentos|libro|delapouite|*
wax-seal|Sello|documentos|lacre|lorc|*
envelope|Sobre|documentos|carta|lorc|*
stone-tablet|Tablilla|documentos||lorc|*
quill-ink|Tintero|documentos|pluma,tinta|lorc|*
subway-pass|Abono de metro|documentos||caro-asercion|
files|Archivos|documentos|ficheros,carpetas|delapouite|
atlas|Atlas|documentos|mapas,libro|delapouite|
calendar-half-year|Calendario semestral|documentos|fecha,almanaque|delapouite|
open-folder|Carpeta abierta|documentos||delapouite|
full-folder|Carpeta llena|documentos|archivo,papeles|delapouite|
love-letter|Carta de amor|documentos||delapouite|
contract|Contrato|documentos|pacto,acuerdo|delapouite|
notebook|Cuaderno|documentos||delapouite|
death-note|Cuaderno de la muerte|documentos|libreta|lorc|
diagram|Diagrama|documentos|esquema|lord-berandas|
diploma|Diploma|documentos|título,pergamino|delapouite|
ticket|Entrada|documentos|billete|delapouite|
paper-arrow|Flecha de papel|documentos||lorc|
chart|Gráfico|documentos|estadística|delapouite|
archive-research|Investigación de archivo|documentos|búsqueda,estudio|delapouite|
hieroglyph-legs|Jeroglífico de piernas|documentos|egipcio,escritura|delapouite|
zigzag-hieroglyph|Jeroglífico en zigzag|documentos||delapouite|
hieroglyph-y|Jeroglífico Y|documentos|egipcio,escritura|delapouite|
pencil|Lápiz|documentos||delapouite|
read|Leer|documentos|libro|skoll|
white-book|Libro blanco|documentos||willdabeast|
rule-book|Libro de reglas|documentos|manual|delapouite|
burning-book|Libro en llamas|documentos|libro,fuego|lorc|
evil-book|Libro maligno|documentos|grimorio|lorc|
black-book|Libro negro|documentos|grimorio,libro|willdabeast|
checklist|Lista de tareas|documentos|casillas|delapouite|
highlighter|Marcador fluorescente|documentos|rotulador,subrayar|delapouite|
bookmark|Marcapáginas|documentos|marcador,libro|lorc|
mona-lisa|Mona Lisa|documentos|cuadro|delapouite|
stabbed-note|Nota apuñalada|documentos|carta,daga|delapouite|
paper|Papel|documentos||john-redman|
folded-paper|Papel doblado|documentos|nota,carta|lorc|
papers|Papeles|documentos||lorc|
papyrus|Papiro|documentos||delapouite|
musical-score|Partitura|documentos|música|delapouite|
passport|Pasaporte|documentos||delapouite|
newspaper|Periódico|documentos||delapouite|
book-pile|Pila de libros|documentos|libros,montón|delapouite|
armor-blueprint|Plano de armadura|documentos|diseño,armadura|seregacthtuf|
quill|Pluma de escribir|documentos|escribir|lorc|
fountain-pen|Pluma estilográfica|documentos|escribir,tinta|lorc|
archive-register|Registro de archivo|documentos|archivo,libro|delapouite|
ink-swirl|Remolino de tinta|documentos|tinta,mancha|lorc|
portrait|Retrato|documentos|cuadro,pintura|delapouite|
classical-knowledge|Saber clásico|documentos|columna,antigüedad|delapouite|
stamper|Sello de mano|documentos|estampador|delapouite|
post-stamp|Sello postal|documentos|franqueo,carta|delapouite|
wax-tablet|Tablilla de cera|documentos||delapouite|
broken-tablet|Tablilla rota|documentos|piedra,escritura|lorc|
book-cover-delapouite|Tapa de libro|documentos|libro,tomo|delapouite|
boarding-pass|Tarjeta de embarque|documentos|billete,vuelo|caro-asercion|
id-card|Tarjeta de identificación|documentos|carné,identidad|delapouite|
meat|Comida|comida|carne|lorc|*
beer-stein|Jarra|comida|jarra de cerveza,bebida|lorc|*
apple-maggot|Manzana|comida|manzana,fruta|lorc|*
bread|Pan|comida|hogaza|delapouite|*
wheat|Trigo|comida|cereal|lorc|*
wine-bottle|Vino|comida|botella|delapouite|*
olive|Aceituna|comida||delapouite|
avocado|Aguacate|comida|fruta|delapouite|
garlic|Ajo|comida|vampiro,planta|delapouite|
artichoke|Alcachofa|comida|verdura|caro-asercion|
booze|Alcohol|comida|bebida,licor|delapouite|
almond|Almendra|comida|fruto seco|delapouite|
rice-cooker|Arrocera|comida|cocina|caro-asercion|
oat|Avena|comida|cereal|lorc|
dumpling-bao|Bao|comida|panecillo|caro-asercion|
barbecue|Barbacoa|comida|parrilla,asado|delapouite|
candy-canes|Bastones de caramelo|comida|dulces,navidad|delapouite|
drink-me|Bébeme|comida|poción,frasco|lorc|
drinking|Beber|comida|bebida|delapouite|
bacon|Beicon|comida|panceta,tocino|delapouite|
aubergine|Berenjena|comida|verdura|lorc|
noodle-ball|Bola de fideos|comida||lorc|
ice-cream-scoop|Bola de helado|comida|helado,postre|delapouite|
chips-bag|Bolsa de patatas fritas|comida|aperitivo|delapouite|
honeypot|Bote de miel|comida|miel,tarro|lorc|
brandy-bottle|Botella de brandy|comida|licor,coñac|lorc|
beer-bottle|Botella de cerveza|comida|cerveza,bebida|delapouite|
soda-bottle|Botella de refresco|comida|bebida|caro-asercion|
sake-bottle|Botella de sake|comida|bebida|seregacthtuf|
glass-celebration|Brindis|comida|copas,fiesta|delapouite|
broccoli|Brócoli|comida|verdura|delapouite|
peanut|Cacahuete|comida||rihlsul|
coffee-pot|Cafetera|comida|bebida|delapouite|
moka-pot|Cafetera moka|comida||delapouite|
pumpkin|Calabaza|comida|hortaliza|delapouite|
sugar-cane|Caña de azúcar|comida||delapouite|
carambola|Carambola|comida|fruta,estrella|delapouite|
wrapped-sweet|Caramelo envuelto|comida||lorc|
milk-carton|Cartón de leche|comida||rihlsul|
saucepan|Cazo|comida|cocina|caro-asercion|
cherry|Cereza|comida|fruta|delapouite|
glass-shot|Chupito|comida|vaso,licor|lorc|
cigarette|Cigarrillo|comida|tabaco|delapouite|
plum|Ciruela|comida|fruta|delapouite|
coconuts|Cocos|comida|fruta|delapouite|
cabbage|Col|comida|repollo,verdura|delapouite|
bok-choy|Col china|comida|verdura|caro-asercion|
eating|Comer|comida|alimentarse|delapouite|
hot-meal|Comida caliente|comida|plato,cena|delapouite|
wine-glass|Copa de vino|comida||lorc|
apple-core|Corazón de manzana|comida|manzana,resto|delapouite|
champagne-cork|Corcho de champán|comida|botella,fiesta|delapouite|
pizza-cutter|Cortapizzas|comida||lorc|
croissant|Cruasán|comida|bollería|delapouite|
fork-knife-spoon|Cubiertos|comida|tenedor,cuchillo,cuchara|delapouite|
fish-bucket|Cubo de pescado|comida|pesca,pez|delapouite|
ladle|Cucharón|comida|cocina|delapouite|
knife-fork|Cuchillo y tenedor|comida|cubiertos|lorc|
ice-cream-cone|Cucurucho de helado|comida|helado,postre|delapouite|
bowl-of-rice|Cuenco de arroz|comida|arroz,tazón|caro-asercion|
berries-bowl|Cuenco de bayas|comida|bayas,fruta|delapouite|
beer-horn|Cuerno de cerveza|comida|cuerno,bebida|delapouite|
cornucopia|Cuerno de la abundancia|comida|cosecha|delapouite|
cheese-wedge|Cuña de queso|comida|queso|lorc|
dango|Dango|comida|dulce,japonés|delapouite|
dozen|Docena|comida|huevos|lorc|
charcuterie|Embutidos|comida|fiambre,jamón|caro-asercion|
dumpling|Empanadilla|comida|dim sum|caro-asercion|
asparagus|Espárrago|comida|verdura|delapouite|
cool-spices|Especias frescas|comida|hierbas|lorc|
hot-spices|Especias picantes|comida|picante,condimento|lorc|
manual-juicer|Exprimidor|comida||delapouite|
noodles|Fideos|comida||delapouite|
fast-noodles|Fideos rápidos|comida|pasta,cuenco|delapouite|
steak|Filete|comida|carne|delapouite|
raspberry|Frambuesa|comida|fruta|delapouite|
strawberry|Fresa|comida||delapouite|
kiwi-fruit|Fruta kiwi|comida||delapouite|
fruit-bowl|Frutero|comida|fruta,cuenco|skoll|
orange-slice|Gajo de naranja|comida||delapouite|
cookie|Galleta|comida|dulce|delapouite|
grain-bundle|Gavilla|comida|cereal,trigo|delapouite|
jelly|Gelatina|comida|postre,gominola|delapouite|
jelly-beans|Gominolas|comida|caramelos,dulces|delapouite|
grain|Grano|comida|cereal,trigo|delapouite|
coffee-beans|Granos de café|comida|bebida|delapouite|
blackcurrant|Grosella negra|comida|bayas,fruta|lorc|
chili-pepper|Guindilla|comida|chile,picante|delapouite|
peas|Guisantes|comida||delapouite|
hamburger|Hamburguesa|comida|bocadillo|delapouite|
flour|Harina|comida|trigo,panadería|delapouite|
gingerbread-man|Hombre de jengibre|comida|galleta,dulce|delapouite|
raw-egg|Huevo crudo|comida|cascado|delapouite|
easter-egg|Huevo de Pascua|comida|huevo|delapouite|
big-egg|Huevo grande|comida|huevo|sbed|
fried-eggs|Huevos fritos|comida|huevo,desayuno|delapouite|
ham-shank|Jamón|comida|pata,cerdo|skoll|
doner-kebab|Kebab|comida|döner|delapouite|
ketchup|Kétchup|comida|salsa,tomate|delapouite|
opened-food-can|Lata abierta|comida|conserva|delapouite|
soda-can|Lata de refresco|comida|bebida|guard13007|
lemon|Limón|comida|fruta|delapouite|
cut-lemon|Limón cortado|comida|fruta|delapouite|
hops|Lúpulo|comida|cerveza,planta|delapouite|
cupcake|Magdalena|comida|dulce,pastel|delapouite|
corn|Maíz|comida|mazorca|delapouite|
tangerine|Mandarina|comida||delapouite|
butter|Mantequilla|comida|lácteo|delapouite|
shiny-apple|Manzana brillante|comida|fruta|lorc|
martini|Martini|comida|cóctel|lorc|
peach|Melocotón|comida|fruta|delapouite|
dripping-honey|Miel goteante|comida|miel|lorc|
chicken-leg|Muslo de pollo|comida|pollo|lorc|
nachos|Nachos|comida||delapouite|
orange|Naranja|comida|fruta|delapouite|
nectar|Néctar|comida||delapouite|
marshmallows|Nubes de azúcar|comida|golosina|delapouite|
oden|Oden|comida||delapouite|
cooking-pot|Olla|comida|cocina,puchero|delapouite|
pressure-cooker|Olla a presión|comida|cocina|caro-asercion|
camp-cooking-pot|Olla de campamento|comida|cocina,hoguera|delapouite|
pouring-pot|Olla vertiendo|comida|cocina,verter|delapouite|
onigori|Onigiri|comida|arroz|delapouite|
chopsticks|Palillos chinos|comida|cubiertos|delapouite|
popcorn|Palomitas|comida|maíz|delapouite|
sliced-bread|Pan de molde|comida|rebanadas|lorc|
honeycomb|Panal|comida|miel,abejas|lorc|
potato|Patata|comida|papa|delapouite|
french-fries|Patatas fritas|comida|fritas,patatas|delapouite|
pickle|Pepinillo|comida||delapouite|
apple-seeds|Pepitas de manzana|comida|semillas,manzana|lorc|
pear|Pera|comida|fruta|delapouite|
hot-dog|Perrito caliente|comida|salchicha,bocadillo|delapouite|
fish-smoking|Pescado ahumado|comida|pez,ahumar|delapouite|
fish-cooked|Pescado asado|comida|pez,cocinado|darkzaitzev|
canned-fish|Pescado en conserva|comida|lata,sardinas|delapouite|
fried-fish|Pescado frito|comida|pez,fritura|darkzaitzev|
manual-meat-grinder|Picadora de carne|comida||delapouite|
banana-peel|Piel de plátano|comida|cáscara,banana|delapouite|
pimiento|Pimiento|comida||delapouite|
bell-pepper|Pimiento morrón|comida|verdura|delapouite|
kebab-spit|Pincho de kebab|comida|carne,brocheta|delapouite|
pineapple|Piña|comida|fruta|delapouite|
smoking-pipe|Pipa|comida|tabaco|delapouite|
spiral-lollipop|Piruleta|comida|dulce|delapouite|
full-pizza|Pizza entera|comida|pizza|delapouite|
banana|Plátano|comida|fruta,banana|delapouite|
banana-peeled|Plátano pelado|comida|banana,fruta|delapouite|
meal|Plato de comida|comida||delapouite|
chicken-oven|Pollo al horno|comida|horno|delapouite|
roast-chicken|Pollo asado|comida|ave|lorc|
ice-pop|Polo de hielo|comida|helado,postre|delapouite|
pizza-slice|Porción de pizza|comida||delapouite|
pie-slice|Porción de tarta|comida||lorc|
joint|Porro|comida|tabaco,cannabis|skoll|
pretzel|Pretzel|comida|rosquilla|delapouite|
leek|Puerro|comida|verdura|delapouite|
croissants-pupil|Pupila de cruasanes|comida|bollería|lorc|
cigar|Puro|comida|tabaco|delapouite|
raddish|Rábano|comida|hortaliza|delapouite|
banana-bunch|Racimo de plátanos|comida|bananas,fruta|delapouite|
bread-slice|Rebanada de pan|comida|pan,tostada|delapouite|
beet|Remolacha|comida|verdura|delapouite|
sausages-ribbon|Ristra de salchichas|comida|embutido|delapouite|
dough-roller|Rodillo de cocina|comida|masa|delapouite|
donut|Rosquilla|comida|dulce,dónut|delapouite|
sausage|Salchicha|comida|embutido|delapouite|
sliced-sausage|Salchicha cortada|comida|embutido|delapouite|
salt-shaker|Salero|comida|sal|lorc|
watermelon|Sandía|comida||delapouite|
sandwich|Sándwich|comida|bocadillo|delapouite|
sesame|Sésamo|comida|semilla|delapouite|
sliced-mushroom|Seta cortada|comida|champiñón|delapouite|
sushis|Sushi|comida||delapouite|
chocolate-bar|Tableta de chocolate|comida|cacao|rihlsul|
tacos|Tacos|comida||delapouite|
honey-jar|Tarro de miel|comida|miel,abejas|delapouite|
stairs-cake|Tarta escalonada|comida|pastel|delapouite|
coffee-cup|Taza de café|comida|bebida|delapouite|
coffee-mug|Tazón de café|comida|bebida|lorc|
boba|Té de burbujas|comida|bebida,té|caro-asercion|
teapot-leaves|Tetera con hojas|comida|té|delapouite|
tomato|Tomate|comida||delapouite|
butter-toast|Tostada con mantequilla|comida|tostada,desayuno|delapouite|
triple-corn|Tres espigas|comida|maíz|lorc|
cake-slice|Trozo de tarta|comida|pastel,postre|lorc|
grapes|Uvas|comida|racimo,vino|lorc|
wok|Wok|comida|sartén|caro-asercion|
carrot|Zanahoria|comida|verdura,hortaliza|delapouite|
beard|Barba|cuerpo|vello,rostro|lorc|*
heart-organ|Corazón|cuerpo|órgano,anatomía|lorc|*
heart-plus|Curación|cuerpo|sanar,vida|zeromancer|*
dna1|Linaje|cuerpo|adn,genética|lorc|*
healing|Sanación|cuerpo|curar,medicina|delapouite|*
dna2|ADN|cuerpo|genética,hélice|lorc|
drowning|Ahogamiento|cuerpo|agua,ahogarse|lorc|
body-height|Altura corporal|cuerpo|estatura,medida|delapouite|
amputation|Amputación|cuerpo|corte,herida|skoll|
anatomy|Anatomía|cuerpo|órganos,cuerpo humano|lorc|
forearm|Antebrazo|cuerpo|brazo|delapouite|
antibody|Anticuerpo|cuerpo|inmunidad,medicina|delapouite|
pummeled|Apaleado|cuerpo|golpeado,paliza|lorc|
heartburn|Ardor de estómago|cuerpo|acidez,malestar|lorc|
half-body-crawling|Arrastrándose|cuerpo|reptar,herido|delapouite|
sly|Astuto|cuerpo|cara,pícaro|lorc|
health-increase|Aumento de salud|cuerpo|curación,vida|sbed|
biceps|Bíceps|cuerpo|músculo,fuerza|delapouite|
mustache|Bigote|cuerpo||delapouite|
mouth-watering|Boca hecha agua|cuerpo||lorc|
medical-pack-alt|Botiquín alternativo|cuerpo||sbed|
arm|Brazo|cuerpo|extremidad|delapouite|
arm-bandage|Brazo vendado|cuerpo|venda,herida|delapouite|
arm-sling|Cabestrillo|cuerpo|brazo,herida|delapouite|
nailed-head|Cabeza clavada|cuerpo|herida|lorc|
dead-head|Cabeza cortada|cuerpo|decapitado,muerto|delapouite|
ribcage|Caja torácica|cuerpo|costillas|lorc|
skull-with-syringe|Calavera con jeringa|cuerpo|veneno|zajkonur|
william-tell-skull|Calavera de Guillermo Tell|cuerpo||lorc|
stoned-skull|Calavera petrificada|cuerpo|piedra|lorc|
surprised-skull|Calavera sorprendida|cuerpo||lorc|
health-capsule|Cápsula de salud|cuerpo|medicina,pastilla|delapouite|
sight-disabled|Ceguera|cuerpo|ciego|skoll|
brain|Cerebro|cuerpo|mente,órgano|lorc|
brain-freeze|Cerebro congelado|cuerpo|helado,dolor|lorc|
splurt|Chorro|cuerpo|sangre|lorc|
scar-wound|Cicatriz|cuerpo|herida|lorc|
reptile-tail|Cola de reptil|cuerpo|lagarto|delapouite|
fangs|Colmillos|cuerpo|dientes,mordisco|skoll|
pretty-fangs|Colmillos afilados|cuerpo|vampiro,dientes|lorc|
backbone-shell|Columna con caparazón|cuerpo|espina,concha|lorc|
spinal-coil|Columna en espiral|cuerpo|vértebras|lorc|
coma|Coma|cuerpo|inconsciente,dormido|lorc|
pierced-heart|Corazón atravesado|cuerpo|herida|lorc|
centaur-heart|Corazón de centauro|cuerpo|centauro|delapouite|
wrapped-heart|Corazón envuelto|cuerpo||lorc|
cold-heart|Corazón frío|cuerpo|hielo|lorc|
heart-inside|Corazón interior|cuerpo|vida,amor|lorc|
chewed-heart|Corazón mordido|cuerpo|mordisco|lorc|
bleeding-heart|Corazón sangrante|cuerpo|sangre,herida|lorc|
maze-cornea|Córnea laberinto|cuerpo|ojo|lorc|
broken-skull|Cráneo roto|cuerpo|calavera,hueso|lorc|
pierced-body|Cuerpo atravesado|cuerpo|herida|lorc|
frozen-body|Cuerpo congelado|cuerpo|hielo,estado|delapouite|
split-body|Cuerpo partido|cuerpo|dividido|lorc|
button-finger|Dedo en botón|cuerpo|pulsar,dedo|delapouite|
pointing|Dedo señalando|cuerpo|mano,señalar|lorc|
fingers-crossed|Dedos cruzados|cuerpo|suerte,mano|generalace135|
barefoot|Descalzo|cuerpo|pie,huella|lorc|
defibrilate|Desfibrilar|cuerpo|reanimar,descarga|lorc|
star-struck|Deslumbrado|cuerpo|estrellas,mareo|delapouite|
tooth|Diente|cuerpo||lorc|
front-teeth|Dientes delanteros|cuerpo|incisivos,boca|lorc|
back-pain|Dolor de espalda|cuerpo|lumbago,dolor|lorc|
night-sleep|Dormir de noche|cuerpo|sueño|delapouite|
embryo|Embrión|cuerpo|feto|lorc|
smitten|Enamorado|cuerpo|amor|lorc|
shrug|Encogerse de hombros|cuerpo|duda|delapouite|
body-balance|Equilibrio corporal|cuerpo|equilibrio,postura|delapouite|
foot-plaster|Escayola en el pie|cuerpo|pie,lesión|delapouite|
skeleton-inside|Esqueleto interior|cuerpo|huesos|lorc|
stomach|Estómago|cuerpo||delapouite|
turd|Excremento|cuerpo||lorc|
fetus|Feto|cuerpo|embrión,bebé|skoll|
muscle-up|Flexión en barra|cuerpo||lorc|
vile-fluid|Fluido repugnante|cuerpo||lorc|
strong|Fuerza|cuerpo|brazo,músculo|lorc|
brain-leak|Fuga cerebral|cuerpo|cerebro,mente|delapouite|
claw|Garra|cuerpo|zarpa,uña|sbed|
claws|Garras|cuerpo|zarpas|delapouite|
eyeball|Globo ocular|cuerpo|ojo|lorc|
fat|Gordura|cuerpo|obeso,grasa|skoll|
heart-drop|Gota de corazón|cuerpo|sangre,vida|lorc|
pill-drop|Gota de píldora|cuerpo||lorc|
medical-drip|Gotero|cuerpo|suero|delapouite|
shouting|Gritando|cuerpo|grito|lorc|
screaming|Grito|cuerpo|gritar|lorc|
open-wound|Herida abierta|cuerpo||lorc|
rough-wound|Herida áspera|cuerpo|rasguño|lorc|
spotted-wound|Herida con manchas|cuerpo|llaga|lorc|
stitched-wound|Herida cosida|cuerpo|sutura|lorc|
sword-wound|Herida de espada|cuerpo||lorc|
feather-wound|Herida de pluma|cuerpo|flecha,herida|lorc|
ragged-wound|Herida desgarrada|cuerpo|desgarro,sangre|lorc|
large-wound|Herida grande|cuerpo||lorc|
internal-injury|Herida interna|cuerpo|lesión,daño|lorc|
bleeding-wound|Herida sangrante|cuerpo|sangre,herida|lorc|
liver|Hígado|cuerpo|órgano|delapouite|
snout|Hocico|cuerpo|morro|lorc|
finger-print|Huella dactilar|cuerpo|identidad,dedo|delapouite|
pelvis-bone|Hueso de la pelvis|cuerpo||delapouite|
broken-bone|Hueso roto|cuerpo|fractura,hueso|lorc|
incisors|Incisivos|cuerpo|dientes,boca|lorc|
bowels|Intestinos|cuerpo|tripas,vísceras|delapouite|
shiny-iris|Iris brillante|cuerpo|ojo|lorc|
syringe|Jeringuilla|cuerpo|inyección|lorc|
syringe-sbed|Jeringuilla médica|cuerpo|inyección|sbed|
lips|Labios|cuerpo|boca|lorc|
sharp-lips|Labios afilados|cuerpo|boca|lorc|
tear-tracks|Lágrimas|cuerpo|llanto|lorc|
heart-beats|Latidos|cuerpo|pulso,corazón|delapouite|
tongue|Lengua|cuerpo||delapouite|
frontal-lobe|Lóbulo frontal|cuerpo|cerebro,mente|lorc|
extra-lucid|Lucidez extra|cuerpo|mente,cerebro|lorc|
bad-breath|Mal aliento|cuerpo|halitosis,aliento|delapouite|
jawbone|Mandíbula|cuerpo|hueso,quijada|lorc|
hand|Mano|cuerpo|palma|lorc|
hand-sbed|Mano abierta|cuerpo|palma|sbed|
hand-ok|Mano con OK|cuerpo|gesto,bien|delapouite|
severed-hand|Mano cortada|cuerpo|amputada|darkzaitzev|
skeletal-hand|Mano esquelética|cuerpo|hueso|delapouite|
hand-bandage|Mano vendada|cuerpo|venda,herida|delapouite|
hair-strands|Mechones de pelo|cuerpo|cabello,pelo|delapouite|
miracle-medecine|Medicina milagrosa|cuerpo||lorc|
medicines|Medicinas|cuerpo||delapouite|
half-heart|Medio corazón|cuerpo|vida,salud|lorc|
half-dead|Medio muerto|cuerpo|moribundo,herido|delapouite|
lost-limb|Miembro perdido|cuerpo|mutilación|quoting|
gaze|Mirada|cuerpo|ojos,vista|lorc|
medical-pack|Mochila médica|cuerpo||sbed|
snake-bite|Mordedura de serpiente|cuerpo|veneno|lorc|
muscle-fat|Músculo y grasa|cuerpo||lorc|
nose-front|Nariz de frente|cuerpo||delapouite|
nose-side|Nariz de perfil|cuerpo||delapouite|
knocked-out-stars|Noqueado|cuerpo|estrellas,aturdido|delapouite|
tired-eye|Ojo cansado|cuerpo||delapouite|
falling-eye|Ojo cayendo|cuerpo|ojo,caída|lorc|
semi-closed-eye|Ojo entornado|cuerpo|mirada|lorc|
sunken-eye|Ojo hundido|cuerpo||lorc|
surrounded-eye|Ojo rodeado|cuerpo||lorc|
bleeding-eye|Ojo sangrante|cuerpo|sangre,herida|lorc|
hunter-eyes|Ojos de cazador|cuerpo|mirada,caza|delapouite|
angry-eyes|Ojos furiosos|cuerpo|enfado,mirada|delapouite|
worried-eyes|Ojos preocupados|cuerpo||lorc|
human-ear|Oreja|cuerpo|oído|delapouite|
elf-ear|Oreja de elfo|cuerpo|élfica|delapouite|
internal-organ|Órgano interno|cuerpo|anatomía,víscera|lorc|
palm|Palma|cuerpo|mano|lorc|
open-palm|Palma abierta|cuerpo|mano|skoll|
cut-palm|Palma cortada|cuerpo|mano,herida|lorc|
medicine-pills|Pastillas|cuerpo|medicina|delapouite|
awareness|Percepción|cuerpo|atención,ojo|lorc|
heart-minus|Perder vida|cuerpo|daño,corazón|zeromancer|
health-decrease|Pérdida de salud|cuerpo|daño,vida|sbed|
eyelashes|Pestañas|cuerpo|ojo,maquillaje|delapouite|
nailed-foot|Pie clavado|cuerpo|herida|lorc|
leg|Pierna|cuerpo||delapouite|
female-legs|Piernas femeninas|cuerpo|piernas,mujer|delapouite|
morgue-feet|Pies de morgue|cuerpo|muerte|delapouite|
pill|Píldora|cuerpo||lorc|
poison|Ponzoña|cuerpo|tóxico|sbed|
hypodermic-test|Prueba hipodérmica|cuerpo|jeringuilla,inyección|lorc|
lungs|Pulmones|cuerpo|órgano|delapouite|
pulse|Pulso|cuerpo|latido|sbed|
star-pupil|Pupila de estrella|cuerpo|ojo|lorc|
burn|Quemadura|cuerpo|fuego,herida|sbed|
remedy|Remedio|cuerpo|medicina,cura|delapouite|
kidneys|Riñones|cuerpo|órgano|delapouite|
knee-bandage|Rodillera vendada|cuerpo||delapouite|
bandage-roll|Rollo de venda|cuerpo|vendaje,gasa|lorc|
knee-cap|Rótula|cuerpo|rodilla|delapouite|
spatter|Salpicadura de gotas|cuerpo|sangre|lorc|
health-normal|Salud normal|cuerpo|vida,cruz|sbed|
spock-hand|Saludo vulcano|cuerpo|mano|delapouite|
blood|Sangre|cuerpo|gota,herida|skoll|
sensuousness|Sensualidad|cuerpo|labios|lorc|
silenced|Silenciado|cuerpo|mudo|delapouite|
overdose|Sobredosis|cuerpo||lorc|
sleepy|Somnoliento|cuerpo|dormido|lorc|
sharp-smile|Sonrisa afilada|cuerpo|dientes|lorc|
life-support|Soporte vital|cuerpo||lorc|
hearing-disabled|Sordera|cuerpo|oído,sordo|skoll|
surprised|Sorpresa|cuerpo|cara|lorc|
suspicious|Sospecha|cuerpo|cara|lorc|
suicide|Suicidio|cuerpo||sbed|
achilles-heel|Talón de Aquiles|cuerpo|punto débil,pie|delapouite|
medical-thermometer|Termómetro médico|cuerpo||delapouite|
terror|Terror|cuerpo|miedo|lorc|
sticking-plaster|Tirita|cuerpo||lorc|
muscular-torso|Torso musculoso|cuerpo||delapouite|
transfuse|Transfusión|cuerpo|sangre|lorc|
triple-skulls|Tres calaveras|cuerpo||lorc|
brain-stem|Tronco encefálico|cuerpo|cerebro,médula|lorc|
piece-skull|Trozo de calavera|cuerpo||lorc|
one-eyed|Tuerto|cuerpo||lorc|
tumor|Tumor|cuerpo|enfermedad|lorc|
fingernail|Uña|cuerpo|dedo,mano|delapouite|
bandaged|Vendado|cuerpo|herido,vendas|lorc|
death-juice|Veneno mortal|cuerpo|frasco,toxina|darkzaitzev|
virus|Virus|cuerpo|enfermedad|lorc|
extra-vision|Visión extra|cuerpo|ojos,vista|delapouite|
night-vision|Visión nocturna|cuerpo|ojo|delapouite|
vomiting|Vómito|cuerpo||lorc|
inner-self|Yo interior|cuerpo|alma,mente|lorc|
sword-clash|Combate|combate|choque,espadas|lorc|*
fist|Puño|combate|golpe,mano|lorc|*
acrobatic|Acrobacia|combate|pirueta,salto|darkzaitzev|
grab|Agarrar|combate|presa,mano|lorc|
grapple|Agarre|combate|lucha,presa|lorc|
fire-breath|Aliento de fuego|combate|dragón,llamas|lorc|
crush|Aplastar|combate|machacar|sbed|
weight-crush|Aplastar con peso|combate||sbed|
targeting|Apuntar|combate||lorc|
armor-downgrade|Armadura reducida|combate|debilitar,defensa|delapouite|
blade-drag|Arrastre de hoja|combate|corte,espada|lorc|
snatch|Arrebatar|combate|robar|lorc|
trench-assault|Asalto a la trinchera|combate||quoting|
bunker-assault|Asalto al búnker|combate|asalto,ataque|quoting|
striking-splinter|Astilla impactando|combate||lorc|
catch|Atrapar|combate|agarrar,captura|darkzaitzev|
human-target|Blanco humano|combate|diana,silueta|delapouite|
sword-brandish|Blandir espada|combate||delapouite|
slap|Bofetada|combate|cachetada|lorc|
wind-slap|Bofetada de viento|combate||lorc|
striking-balls|Bolas en choque|combate||lorc|
fall-down|Caída|combate|tropiezo,derribo|sbed|
blade-fall|Caída de hoja|combate|guillotina,corte|lorc|
heavy-fall|Caída pesada|combate|golpe,derribo|lorc|
skull-crack|Calavera agrietada|combate|cráneo|lorc|
skull-slices|Calavera cortada|combate|cráneo|lorc|
chopped-skull|Calavera partida|combate|hachazo,muerte|lorc|
switch-weapon|Cambiar de arma|combate||delapouite|
forward-field|Campo de avance|combate|escudo,empuje|lorc|
spiky-field|Campo de pinchos|combate|trampa|lorc|
thrown-charcoal|Carbón lanzado|combate||lorc|
charging|Carga|combate|embestida,arremeter|delapouite|
boulder-dash|Carga de roca|combate|roca,rodar|delapouite|
fire-dash|Carrera de fuego|combate|embestida,llamas|lorc|
falling|Cayendo|combate|caída,precipicio|sbed|
encirclement|Cerco|combate|rodear|delapouite|
sonic-screech|Chillido sónico|combate|sonido|lorc|
sabers-choc|Choque de sables|combate|duelo|lorc|
steam-blast|Chorro de vapor|combate||delapouite|
run|Correr|combate|carrera|lorc|
scalpel-strike|Corte de bisturí|combate|cirugía|lorc|
thrown-knife|Cuchillo lanzado|combate||lorc|
thrown-daggers|Dagas lanzadas|combate||lorc|
decapitation|Decapitación|combate|guillotina,cabeza|lorc|
egg-defense|Defensa del huevo|combate|nido,proteger|lorc|
demolish|Demoler|combate|derribar,destruir|lorc|
tearing|Desgarro|combate||lorc|
divert|Desviar|combate|esquivar,flecha|lorc|
striking-diamonds|Diamantes en choque|combate||lorc|
bullseye|Diana|combate|blanco,centro|skoll|
archery-target|Diana de tiro con arco|combate|diana,blanco|lorc|
gunshot|Disparo|combate|bala,arma de fuego|lorc|
headshot|Disparo a la cabeza|combate|tiro,puntería|lorc|
helmet-head-shot|Disparo al casco|combate|tiro,yelmo|lorc|
cannon-shot|Disparo de cañón|combate|cañonazo,artillería|lorc|
hydra-shot|Disparo de hidra|combate|ataque,monstruo|lorc|
double-shot|Disparo doble|combate|tiro|lorc|
distraction|Distracción|combate|señuelo|lorc|
distraction-darkzaitzev|Distracción engañosa|combate|señuelo,truco|darkzaitzev|
duel|Duelo|combate|enfrentamiento|sbed|
shield-echoes|Ecos de escudo|combate|defensa|lorc|
push|Empujar|combate|empujón|delapouite|
on-target|En el blanco|combate|diana|lorc|
confrontation|Enfrentamiento|combate|duelo|delapouite|
enrage|Enfurecer|combate|rabia,ira|delapouite|
misdirection|Engaño|combate||delapouite|
acid-shield|Escudo de ácido|combate|defensa,corrosión|seregacthtuf|
shield-bounces|Escudo rebotando|combate|lanzamiento|lorc|
shield-reflect|Escudo reflectante|combate|reflejar|lorc|
temporary-shield|Escudo temporal|combate||delapouite|
vibrating-shield|Escudo vibrante|combate||delapouite|
web-spit|Escupir telaraña|combate|araña|lorc|
spinning-sword|Espada giratoria|combate|torbellino|lorc|
sprint|Esprint|combate|correr|lorc|
dodging|Esquiva|combate|evasión,agilidad|lorc|
dodge|Esquivar|combate|evasión|felbrigg|
sonic-boom|Estampido sónico|combate|onda|lorc|
thrust|Estocada|combate||felbrigg|
thrust-bend|Estocada curva|combate||delapouite|
knife-thrust|Estocada de cuchillo|combate|puñalada|lorc|
spiral-thrust|Estocada en espiral|combate|ataque|lorc|
evasion|Evasión|combate|huida,esquivar|delapouite|
avoidance|Evitar|combate|esquivar,huir|delapouite|
overkill|Exceso de daño|combate||sbed|
blast|Explosión|combate|estallido,detonación|sbed|
bright-explosion|Explosión brillante|combate|estallido,luz|lorc|
mine-explosion|Explosión de mina|combate||lorc|
punch-blast|Explosión de puñetazo|combate|golpe,impacto|lorc|
explosion-rays|Explosión de rayos|combate|estallido,impacto|lorc|
corner-explosion|Explosión en la esquina|combate|estallido|lorc|
spiky-explosion|Explosión espinosa|combate|estallido|lorc|
arrow-dunk|Flecha clavada|combate|flecha,impacto|lorc|
slicing-arrow|Flecha cortante|combate|tajo|lorc|
arrowed|Flechado|combate|herido,flecha|lorc|
smash-arrows|Flechas de impacto|combate|choque|lorc|
spiky-pit|Foso de pinchos|combate|trampa|delapouite|
unfriendly-fire|Fuego amigo|combate||lorc|
mighty-force|Fuerza poderosa|combate||delapouite|
shining-claw|Garra brillante|combate|zarpazo|lorc|
midnight-claw|Garra de medianoche|combate||lorc|
flaming-claw|Garra en llamas|combate|zarpa,fuego|lorc|
crossed-claws|Garras cruzadas|combate|zarpas|lorc|
flame-claws|Garras de fuego|combate|zarpas,llamas|lorc|
moon-claws|Garras lunares|combate||lorc|
poison-gas|Gas venenoso|combate|tóxico,nube|lorc|
trigger-hurt|Gatillo|combate||sbed|
sword-spin|Giro de espada|combate||lorc|
flame-spin|Giro de llamas|combate|torbellino,fuego|lorc|
round-struck|Golpe circular|combate|impacto|lorc|
shield-bash|Golpe de escudo|combate|embestida|delapouite|
sword-slice|Golpe de espada|combate|tajo|lorc|
hammer-break|Golpe de martillo|combate|romper,martillo|delapouite|
wave-strike|Golpe de ola|combate||lorc|
overhead|Golpe desde arriba|combate||felbrigg|
sideswipe|Golpe lateral|combate|barrido|felbrigg|
deadly-strike|Golpe mortal|combate|ataque|lorc|
sonic-shout|Grito sónico|combate|onda|lorc|
static-guard|Guardia estática|combate|defensa|lorc|
shatter|Hacer añicos|combate|romper|lorc|
axe-swing|Hachazo|combate|golpe,hacha|lorc|
shield-impact|Impacto en escudo|combate|golpe|delapouite|
gooey-impact|Impacto viscoso|combate|baba,golpe|lorc|
bullet-impacts|Impactos de bala|combate|balas,disparo|delapouite|
implosion|Implosión|combate|colapso,vacío|lorc|
thrown-spear|Lanza arrojada|combate||lorc|
underhand|Lanzamiento por debajo|combate||felbrigg|
throwing-ball|Lanzar una bola|combate||delapouite|
whiplash|Latigazo|combate||lorc|
hammer-drop|Martillazo|combate|golpe,martillo|lorc|
armor-upgrade|Mejora de armadura|combate|reforzar,defensa|delapouite|
arrow-scope|Mira de flecha|combate|apuntar,diana|lorc|
blade-bite|Mordisco de hoja|combate|corte,espada|lorc|
shark-bite|Mordisco de tiburón|combate|mordedura|delapouite|
knockout|Nocaut|combate|golpe|skoll|
targeted|Objetivo fijado|combate||sbed|
dead-eye|Ojo certero|combate|puntería,mira|lorc|
eye-target|Ojo en la diana|combate|puntería,objetivo|delapouite|
stick-splitting|Partir un palo|combate||lorc|
bombing-run|Pasada de bombardeo|combate|bombas,avión|lorc|
high-kick|Patada alta|combate|patada,artes marciales|delapouite|
boot-kick|Patada con bota|combate|patada,golpe|lorc|
crow-dive|Picado de cuervo|combate|ataque,ave|lorc|
striking-clamps|Pinzas golpeando|combate||lorc|
trample|Pisotear|combate||sbed|
stomp|Pisotón|combate||lorc|
boot-stomp|Pisotón con bota|combate|pisada,bota|lorc|
stomp-tornado|Pisotón con tornado|combate||lorc|
quake-stomp|Pisotón sísmico|combate|terremoto|lorc|
swords-power|Poder de espadas|combate||delapouite|
impact-point|Punto de impacto|combate|golpe,diana|lorc|
backstab|Puñalada trapera|combate|apuñalar,traición|lorc|
punch|Puñetazo|combate|golpe,puño|lorc|
high-punch|Puñetazo alto|combate|golpe,artes marciales|delapouite|
armor-punch|Puñetazo blindado|combate|golpe,puño|delapouite|
fire-punch|Puñetazo de fuego|combate|golpe,llamas|lorc|
fulguro-punch|Puñetazo fulgurante|combate|golpe,rayo|lorc|
fist-skoll|Puño cerrado|combate|golpe,mano|skoll|
laserburn|Quemadura láser|combate||lorc|
strafe|Ráfaga lateral|combate||lorc|
ricochet|Rebote|combate|rebotar|caro-asercion|
riposte|Réplica de esgrima|combate|contraataque|andymeneely|
rally-the-troops|Reunir a las tropas|combate|arengar,inspirar|lorc|
sword-break|Romper espada|combate||lorc|
groundbreaker|Rompesuelos|combate|golpe,terremoto|lorc|
jump-across|Salto|combate|saltar,brincar|delapouite|
pounce|Salto de ataque|combate|abalanzarse,zarpazo|sbed|
overdrive|Sobrecarga|combate||lorc|
drop-weapon|Soltar arma|combate|desarmar|skoll|
van-damme-split|Spagat|combate||delapouite|
saber-slash|Tajo de sable|combate|corte|lorc|
serrated-slash|Tajo dentado|combate|corte|lorc|
quick-slash|Tajo rápido|combate|corte|lorc|
atomic-slashes|Tajos atómicos|combate|cortes,energía|lorc|
crossed-slashes|Tajos cruzados|combate|cortes|lorc|
lightning-slashes|Tajos de rayo|combate||lorc|
pull|Tirar|combate|atraer|delapouite|
head-shot|Tiro a la cabeza|combate|disparo,cráneo|sbed|
target-shot|Tiro al blanco|combate||lorc|
headshot-skoll|Tiro en la cabeza|combate|tiro,puntería|skoll|
sinking-trap|Trampa hundida|combate|foso|lorc|
triple-scratches|Triple arañazo|combate||lorc|
triple-claws|Triple garra|combate||lorc|
multiple-targets|Varios objetivos|combate||delapouite|
cartwheel|Voltereta lateral|combate|acrobacia,rueda|lorc|
foot-trip|Zancadilla|combate|tropiezo,derribo|lorc|
claw-slashes|Zarpazos|combate|arañazos,garras|lorc|
air-zigzag|Zigzag de aire|combate|ráfaga,viento|lorc|
chess-knight|Ajedrez|ocio|caballo,ajedrez|skoll|*
harp|Arpa|ocio|música,instrumento|delapouite|*
card-random|Carta de juego|ocio|naipe,azar|faithtoken|*
perspective-dice-six-faces-random|Dado|ocio|d6,azar|delapouite|*
dice-twenty-faces-twenty|Dado de veinte|ocio|d20,crítico|delapouite|*
rolling-dices|Dados|ocio|tirada|delapouite|*
puzzle|Enigma|ocio|rompecabezas,acertijo|delapouite|*
meeple|Ficha de persona|ocio||delapouite|*
flute|Flauta|ocio|música,instrumento|delapouite|*
lyre|Lira|ocio|música|lorc|*
drum|Tambor|ocio|percusión,música|delapouite|*
theater|Teatro|ocio||delapouite|*
accordion|Acordeón|ocio|música,instrumento|caro-asercion|
tune-pitch|Afinar|ocio|música|lorc|
chess-bishop|Alfil|ocio|ajedrez|skoll|
ace|As|ocio|carta,naipe|lorc|
card-ace-hearts|As de corazones|ocio|carta,naipe|aussiesim|
card-ace-diamonds|As de diamantes|ocio|carta,naipe|aussiesim|
fire-ace|As de fuego|ocio|carta,naipe|lorc|
card-ace-spades|As de picas|ocio|carta,naipe|aussiesim|
card-ace-clubs|As de tréboles|ocio|carta,naipe|aussiesim|
paper-plane|Avión de papel|ocio||delapouite|
backgammon|Backgammon|ocio|juego de mesa,tablero|delapouite|
bullet-bill|Bala con cara|ocio|videojuego,proyectil|delapouite|
basketball-ball|Balón de baloncesto|ocio|pelota,deporte|delapouite|
soccer-ball|Balón de fútbol|ocio|deporte|delapouite|
american-football-ball|Balón de fútbol americano|ocio|pelota,deporte|delapouite|
volleyball-ball|Balón de voleibol|ocio||delapouite|
cracked-ball-dunk|Balón roto|ocio|baloncesto|lorc|
golf-flag|Bandera de golf|ocio|hoyo,deporte|delapouite|
corner-flag|Banderín de córner|ocio|fútbol|delapouite|
party-flags|Banderines de fiesta|ocio||delapouite|
banjo|Banjo|ocio|música,instrumento|delapouite|
paper-boat|Barco de papel|ocio||delapouite|
player-base|Base de jugador|ocio|peana,ficha|delapouite|
cricket-bat|Bate de críquet|ocio|deporte|delapouite|
drum-kit|Batería|ocio|percusión,música|caro-asercion|
film-spool|Bobina de película|ocio|cine,carrete|delapouite|
eight-ball|Bola ocho|ocio|billar|delapouite|
bowling-alley|Bolera|ocio|bolos,pista|delapouite|
bowling-pin|Bolo|ocio|bolos|delapouite|
jigsaw-box|Caja de puzle|ocio|rompecabezas,juego|lorc|
soccer-field|Campo de fútbol|ocio|deporte|delapouite|
footy-field|Campo de rugby|ocio|deporte,césped|delapouite|
basketball-basket|Canasta de baloncesto|ocio|aro,deporte|delapouite|
disc-golf-basket|Canasta de disc golf|ocio|deporte|delapouite|
love-song|Canción de amor|ocio|música|lorc|
marbles|Canicas|ocio||delapouite|
sing|Cantar|ocio|música|lorc|
coinflip|Cara o cruz|ocio|moneda,azar|caro-asercion|
carillon|Carillón|ocio|campanas,música|lorc|
carnyx|Carnyx|ocio|trompeta,celta|cathelineau|
up-card|Carta boca arriba|ocio||delapouite|
cycling|Ciclismo|ocio|bicicleta,deporte|delapouite|
card-5-hearts|Cinco de corazones|ocio|carta,naipe|aussiesim|
card-5-diamonds|Cinco de diamantes|ocio|carta,naipe|aussiesim|
card-5-spades|Cinco de picas|ocio|carta,naipe|aussiesim|
card-5-clubs|Cinco de tréboles|ocio|carta,naipe|aussiesim|
spinning-ribbons|Cintas giratorias|ocio|gimnasia|lorc|
meeple-circle|Círculo de fichas|ocio||delapouite|
clapperboard|Claqueta|ocio|cine|delapouite|
clarinet|Clarinete|ocio|instrumento,música|caro-asercion|
f-clef|Clave de fa|ocio|música,partitura|delapouite|
g-clef|Clave de sol|ocio|música,partitura|delapouite|
firework-rocket|Cohete de fuegos artificiales|ocio|pirotecnia,fiesta|lorc|
tree-swing|Columpio de árbol|ocio||delapouite|
jumping-rope|Comba|ocio|saltar,cuerda|delapouite|
kite|Cometa de papel|ocio||delapouite|
card-joker|Comodín|ocio|carta,naipe,joker|delapouite|
buy-card|Comprar carta|ocio|cartas,naipe|delapouite|
rugby-conversion|Conversión de rugby|ocio|deporte|delapouite|
boxing-ring|Cuadrilátero|ocio|boxeo,ring|delapouite|
card-4-hearts|Cuatro de corazones|ocio|carta,naipe|aussiesim|
card-4-diamonds|Cuatro de diamantes|ocio|carta,naipe|aussiesim|
card-4-spades|Cuatro de picas|ocio|carta,naipe|aussiesim|
card-4-clubs|Cuatro de tréboles|ocio|carta,naipe|aussiesim|
rolling-dice-cup|Cubilete de dados|ocio|dados|delapouite|
tightrope|Cuerda floja|ocio||delapouite|
hunting-horn|Cuerno de caza|ocio|trompa,llamada|lorc|
d4|Dado de cuatro|ocio|d4,dado|skoll|
d10|Dado de diez|ocio|d10,dado|skoll|
d12|Dado de doce|ocio|d12,dado|skoll|
dice-eight-faces-eight|Dado de ocho|ocio|d8,dado|delapouite|
perspective-dice-six-faces-five|Dado de seis caras cinco|ocio||delapouite|
perspective-dice-six-faces-four|Dado de seis caras cuatro|ocio||delapouite|
perspective-dice-six-faces-two|Dado de seis caras dos|ocio||delapouite|
perspective-dice-six-faces-six|Dado de seis caras seis|ocio||delapouite|
perspective-dice-six-faces-three|Dado de seis caras tres|ocio||delapouite|
perspective-dice-six-faces-one|Dado de seis caras uno|ocio||delapouite|
dice-twenty-faces-one|Dado de veinte, uno|ocio|d20,pifia|delapouite|
perspective-dice-five|Dado en perspectiva cinco|ocio||delapouite|
perspective-dice-four|Dado en perspectiva cuatro|ocio||delapouite|
perspective-dice-two|Dado en perspectiva dos|ocio||delapouite|
perspective-dice-six|Dado en perspectiva seis|ocio||delapouite|
perspective-dice-three|Dado en perspectiva tres|ocio||delapouite|
perspective-dice-one|Dado en perspectiva uno|ocio||delapouite|
inverted-dice-1|Dado invertido 1|ocio|dado,uno|skoll|
inverted-dice-2|Dado invertido 2|ocio|dado,dos|skoll|
inverted-dice-3|Dado invertido 3|ocio|dado,tres|skoll|
inverted-dice-4|Dado invertido 4|ocio|dado,cuatro|skoll|
inverted-dice-5|Dado invertido 5|ocio|dado,cinco|skoll|
inverted-dice-6|Dado invertido 6|ocio|dado,seis|skoll|
dice-target|Dado y diana|ocio|puntería,dado|delapouite|
dice-shield|Dado y escudo|ocio|defensa,dado|delapouite|
dice-six-faces-five|Dado, cinco|ocio|d6,dado|delapouite|
dice-six-faces-four|Dado, cuatro|ocio|d6,dado|delapouite|
dice-six-faces-two|Dado, dos|ocio|d6,dado|delapouite|
dice-six-faces-six|Dado, seis|ocio|d6,dado|delapouite|
dice-six-faces-three|Dado, tres|ocio|d6,dado|delapouite|
dice-six-faces-one|Dado, uno|ocio|d6,dado|delapouite|
chess-queen|Dama de ajedrez|ocio|reina,ajedrez|skoll|
card-discard|Descartar carta|ocio|tirar|faithtoken|
diamonds|Diamantes|ocio|palo,naipe|skoll|
target-poster|Diana de papel|ocio||delapouite|
flying-target|Diana voladora|ocio|plato,tiro|delapouite|
card-10-hearts|Diez de corazones|ocio|carta,naipe|aussiesim|
card-10-diamonds|Diez de diamantes|ocio|carta,naipe|aussiesim|
card-10-spades|Diez de picas|ocio|carta,naipe|aussiesim|
card-10-clubs|Diez de tréboles|ocio|carta,naipe|aussiesim|
frisbee|Disco volador|ocio|frisbi,juego|delapouite|
card-2-hearts|Dos de corazones|ocio|carta,naipe|aussiesim|
card-2-diamonds|Dos de diamantes|ocio|carta,naipe|aussiesim|
card-2-spades|Dos de picas|ocio|carta,naipe|aussiesim|
card-2-clubs|Dos de tréboles|ocio|carta,naipe|aussiesim|
meeple-army|Ejército de fichas|ocio||delapouite|
card-pick|Elegir carta|ocio|escoger|faithtoken|
slalom|Eslalon|ocio|esquí|delapouite|
skier|Esquiador|ocio|nieve|delapouite|
skis|Esquís|ocio|nieve|delapouite|
dig-dug|Excavador|ocio|videojuego,cavar|lorc|
bassoon|Fagot|ocio|música,instrumento|caro-asercion|
token|Ficha|ocio||delapouite|
meeple-king|Ficha rey|ocio||delapouite|
domino-tiles|Fichas de dominó|ocio|juego|delapouite|
pan-flute|Flauta de pan|ocio|música|delapouite|
pinball-flipper|Flíper|ocio||delapouite|
babyfoot-players|Futbolín|ocio|juego,fútbol|delapouite|
bagpipes|Gaita|ocio|música,instrumento|delapouite|
balloons|Globos|ocio|fiesta,celebración|lorc|
gong|Gong|ocio|música,percusión|delapouite|
party-hat|Gorro de fiesta|ocio||delapouite|
paper-crane|Grulla de papel|ocio|origami|caro-asercion|
meeple-group|Grupo de fichas|ocio||delapouite|
baseball-glove|Guante de béisbol|ocio|deporte,guante|delapouite|
boxing-glove|Guante de boxeo|ocio|boxeo,puño|lorc|
boxing-glove-surprise|Guante de boxeo sorpresa|ocio|boxeo,resorte|lorc|
guitar|Guitarra|ocio|música,instrumento|lorc|
anthem|Himno|ocio|canto,música|lorc|
hockey|Hockey|ocio|deporte,palo|delapouite|
card-exchange|Intercambiar cartas|ocio|cambiar|delapouite|
card-jack-hearts|Jota de corazones|ocio|carta,naipe|aussiesim|
card-jack-diamonds|Jota de diamantes|ocio|carta,naipe|aussiesim|
card-jack-spades|Jota de picas|ocio|carta,naipe|aussiesim|
card-jack-clubs|Jota de tréboles|ocio|carta,naipe|aussiesim|
tabletop-players|Jugadores de mesa|ocio||delapouite|
card-play|Jugar carta|ocio|echar|quoting|
bowling-propulsion|Lanzamiento de bolera|ocio|bolos,bola|lorc|
console-controller|Mando de consola|ocio|videojuegos|skoll|
retro-controller|Mando retro|ocio|videojuego|skoll|
poker-hand|Mano de póker|ocio|cartas,naipes|lorc|
maracas|Maracas|ocio|música|delapouite|
puppet|Marioneta|ocio|títere|lorc|
carnival-mask|Máscara de carnaval|ocio|antifaz,fiesta|delapouite|
double-face-mask|Máscara de dos caras|ocio|teatro,duplicidad|lorc|
duality-mask|Máscara de dualidad|ocio|teatro|lorc|
curly-mask|Máscara rizada|ocio|teatro|lorc|
drama-masks|Máscaras de teatro|ocio|comedia,tragedia|lorc|
matryoshka-dolls|Matrioshkas|ocio|muñecas|delapouite|
juggling-clubs|Mazas de malabarismo|ocio|circo,malabares|delapouite|
3d-meeple|Meeple 3D|ocio|ficha,juego de mesa|delapouite|
abbot-meeple|Meeple de abad|ocio|ficha,monje|delapouite|
zigzag-tune|Melodía en zigzag|ocio|música|lorc|
pool-table-corner|Mesa de billar|ocio|esquina,billar|delapouite|
metronome|Metrónomo|ocio|música|delapouite|
microphone|Micrófono|ocio||delapouite|
paper-windmill|Molinillo de papel|ocio||delapouite|
musical-notes|Notas musicales|ocio||delapouite|
card-9-hearts|Nueve de corazones|ocio|carta,naipe|aussiesim|
card-9-diamonds|Nueve de diamantes|ocio|carta,naipe|aussiesim|
card-9-spades|Nueve de picas|ocio|carta,naipe|aussiesim|
card-9-clubs|Nueve de tréboles|ocio|carta,naipe|aussiesim|
ocarina|Ocarina|ocio|música|delapouite|
card-8-hearts|Ocho de corazones|ocio|carta,naipe|aussiesim|
card-8-diamonds|Ocho de diamantes|ocio|carta,naipe|aussiesim|
card-8-spades|Ocho de picas|ocio|carta,naipe|aussiesim|
card-8-clubs|Ocho de tréboles|ocio|carta,naipe|aussiesim|
pipe-organ|Órgano de tubos|ocio|música|caro-asercion|
otamatone|Otamatone|ocio|música|delapouite|
cootie-catcher|Pajarita de papel|ocio|adivinación|caro-asercion|
guitar-bass-head|Pala de bajo|ocio|bajo,instrumento|delapouite|
guitar-head|Pala de guitarra|ocio|clavijero,instrumento|delapouite|
ping-pong-bat|Pala de ping-pong|ocio||delapouite|
suits|Palos de baraja|ocio|cartas|lorc|
tambourine|Pandereta|ocio|música|delapouite|
soccer-kick|Patada de fútbol|ocio|deporte|delapouite|
ice-skate|Patín de hielo|ocio|patinaje,deporte|delapouite|
plastic-duck|Pato de goma|ocio|juguete,baño|delapouite|
beach-ball|Pelota de playa|ocio|balón,playa|delapouite|
tennis-ball|Pelota de tenis|ocio||delapouite|
chess-pawn|Peón|ocio|ajedrez|skoll|
pawn|Peón de ajedrez sencillo|ocio|ajedrez|lorc|
spinning-top|Peonza|ocio|trompo|skoll|
balloon-dog|Perro de globo|ocio|globo,fiesta|delapouite|
weight-lifting-down|Pesa bajando|ocio||delapouite|
weight-lifting-up|Pesa subiendo|ocio||delapouite|
grand-piano|Piano de cola|ocio|música,instrumento|caro-asercion|
spades|Picas|ocio|naipe|skoll|
curling-stone|Piedra de curling|ocio|deporte|delapouite|
jigsaw-piece|Pieza de puzle|ocio|rompecabezas,encajar|lorc|
l-brick|Pieza en L|ocio|bloque|delapouite|
o-brick|Pieza en O|ocio|bloque|delapouite|
i-brick|Pieza I|ocio|ladrillo,tetris|delapouite|
j-brick|Pieza J|ocio|ladrillo,tetris|delapouite|
pinata|Piñata|ocio||delapouite|
tennis-court|Pista de tenis|ocio||delapouite|
water-gun|Pistola de agua|ocio||delapouite|
bowling-strike|Pleno de bolos|ocio|bolos,derribo|delapouite|
podium|Podio|ocio|pódium|delapouite|
target-prize|Premio de diana|ocio||delapouite|
podium-winner|Primer puesto|ocio|podio,ganador|delapouite|
film-projector|Proyector de cine|ocio|película,cine|delapouite|
pick-of-destiny|Púa del destino|ocio|guitarra|delapouite|
card-burn|Quemar carta|ocio|descartar,fuego|delapouite|
paper-frog|Rana de papel|ocio|origami|caro-asercion|
tennis-racket|Raqueta de tenis|ocio||delapouite|
card-pickup|Recoger cartas|ocio|coger|quoting|
card-queen-hearts|Reina de corazones|ocio|carta,naipe|aussiesim|
card-queen-diamonds|Reina de diamantes|ocio|carta,naipe|aussiesim|
card-queen-spades|Reina de picas|ocio|carta,naipe|aussiesim|
card-queen-clubs|Reina de tréboles|ocio|carta,naipe|aussiesim|
chess-king|Rey de ajedrez|ocio|ajedrez|skoll|
card-king-hearts|Rey de corazones|ocio|carta,naipe|aussiesim|
card-king-diamonds|Rey de diamantes|ocio|carta,naipe|aussiesim|
card-king-spades|Rey de picas|ocio|carta,naipe|aussiesim|
card-king-clubs|Rey de tréboles|ocio|carta,naipe|aussiesim|
card-draw|Robar carta|ocio|sacar|faithtoken|
skipping-rope|Saltar a la comba|ocio|saltar|delapouite|
pool-dive|Salto a la piscina|ocio|zambullida,nadar|delapouite|
leapfrog|Salto de rana|ocio|juego|delapouite|
saxophone|Saxofón|ocio|música|delapouite|
podium-second|Segundo puesto|ocio|podio,plata|delapouite|
card-6-hearts|Seis de corazones|ocio|carta,naipe|aussiesim|
card-6-diamonds|Seis de diamantes|ocio|carta,naipe|aussiesim|
card-6-spades|Seis de picas|ocio|carta,naipe|aussiesim|
card-6-clubs|Seis de tréboles|ocio|carta,naipe|aussiesim|
double-quaver|Semicorcheas|ocio|música,nota|lorc|
card-7-hearts|Siete de corazones|ocio|carta,naipe|aussiesim|
card-7-diamonds|Siete de diamantes|ocio|carta,naipe|aussiesim|
card-7-spades|Siete de picas|ocio|carta,naipe|aussiesim|
card-7-clubs|Siete de tréboles|ocio|carta,naipe|aussiesim|
skateboarding-02|Skater en acción|ocio|monopatín|caro-asercion|
skateboarding-01|Skater saltando|ocio|monopatín|caro-asercion|
snitch-quidditch-ball|Snitch dorada|ocio|quidditch|delapouite|
wave-surfer|Surfista|ocio||delapouite|
snowboard|Tabla de snowboard|ocio|nieve|delapouite|
surf-board|Tabla de surf|ocio||delapouite|
empty-chessboard|Tablero de ajedrez vacío|ocio|damero|delapouite|
tarot-07-the-chariot|Tarot: el Carro|ocio|carta|caro-asercion|
tarot-12-the-hanged-man|Tarot: el Colgado|ocio|carta|caro-asercion|
tarot-15-the-devil|Tarot: el Diablo|ocio|carta|caro-asercion|
tarot-04-the-emperor|Tarot: el Emperador|ocio|carta|caro-asercion|
tarot-09-the-hermit|Tarot: el Ermitaño|ocio|carta|caro-asercion|
tarot-05-the-hierophant|Tarot: el Hierofante|ocio|carta|caro-asercion|
tarot-20-judgement|Tarot: el Juicio|ocio|carta|caro-asercion|
tarot-00-the-fool|Tarot: el Loco|ocio|carta|caro-asercion|
tarot-01-the-magician|Tarot: el Mago|ocio|carta|caro-asercion|
tarot-21-the-world|Tarot: el Mundo|ocio|carta|caro-asercion|
tarot-19-the-sun|Tarot: el Sol|ocio|carta|caro-asercion|
tarot-03-the-empress|Tarot: la Emperatriz|ocio|carta|caro-asercion|
tarot-17-the-star|Tarot: la Estrella|ocio|carta|caro-asercion|
tarot-08-strength|Tarot: la Fuerza|ocio|carta|caro-asercion|
tarot-11-justice|Tarot: la Justicia|ocio|carta|caro-asercion|
tarot-18-the-moon|Tarot: la Luna|ocio|carta|caro-asercion|
tarot-13-death|Tarot: la Muerte|ocio|carta|caro-asercion|
tarot-10-wheel-of-fortune|Tarot: la Rueda de la Fortuna|ocio|carta|caro-asercion|
tarot-02-the-high-priestess|Tarot: la Sacerdotisa|ocio|carta|caro-asercion|
tarot-14-temperance|Tarot: la Templanza|ocio|carta|caro-asercion|
tarot-16-the-tower|Tarot: la Torre|ocio|carta|caro-asercion|
tarot-06-the-lovers|Tarot: los Enamorados|ocio|carta|caro-asercion|
musical-keyboard|Teclado musical|ocio|piano|delapouite|
piano-keys|Teclas de piano|ocio|música|delapouite|
golf-tee|Tee de golf|ocio|pelota,deporte|delapouite|
theater-curtains|Telón de teatro|ocio||delapouite|
podium-third|Tercer puesto|ocio|podio,bronce|delapouite|
carousel|Tiovivo|ocio|feria,caballitos|delapouite|
film-strip|Tira de película|ocio|cine,fotogramas|delapouite|
party-popper|Tirador de confeti|ocio||delapouite|
kid-slide|Tobogán|ocio|parque|delapouite|
bugle-call|Toque de corneta|ocio|trompeta,música|lorc|
chess-rook|Torre de ajedrez|ocio|ajedrez|skoll|
slot-machine|Tragaperras|ocio|casino|caro-asercion|
clubs|Tréboles|ocio|palo,naipe|skoll|
card-3-hearts|Tres de corazones|ocio|carta,naipe|aussiesim|
card-3-diamonds|Tres de diamantes|ocio|carta,naipe|aussiesim|
card-3-spades|Tres de picas|ocio|carta,naipe|aussiesim|
card-3-clubs|Tres de tréboles|ocio|carta,naipe|aussiesim|
tic-tac-toe|Tres en raya|ocio||delapouite|
pool-triangle|Triángulo de billar|ocio|bolas|delapouite|
trombone|Trombón|ocio|música|caro-asercion|
french-horn|Trompa|ocio|música,instrumento|caro-asercion|
trumpet|Trompeta|ocio|música|delapouite|
trumpet-flag|Trompeta con bandera|ocio|música|delapouite|
magick-trick|Truco de magia|ocio||delapouite|
tuba|Tuba|ocio|música|caro-asercion|
viola|Viola|ocio|música|lorc|
violin|Violín|ocio|música|zajkonur|
shuttlecock|Volante de bádminton|ocio|deporte|delapouite|
vuvuzelas|Vuvuzelas|ocio||delapouite|
water-polo|Waterpolo|ocio||delapouite|
xylophone|Xilófono|ocio|música|delapouite|
djembe|Yembé|ocio|tambor,percusión|delapouite|
yunluo|Yunluo|ocio|música,gong|delapouite|
cog|Engranaje|tecnologia|rueda dentada|lorc|*
clockwork|Mecanismo|tecnologia|engranajes,relojería|lorc|*
mass-driver|Acelerador de masa|tecnologia||sbed|
wind-turbine|Aerogenerador|tecnologia||delapouite|
speaker|Altavoz|tecnologia|sonido|delapouite|
amplitude|Amplitud|tecnologia|onda,señal|lord-berandas|
transportation-rings|Anillos de transporte|tecnologia||lorc|
radar-dish|Antena parabólica|tecnologia|radar,satélite|lorc|
robot-antennas|Antenas de robot|tecnologia|cabeza|delapouite|
spider-bot|Araña robot|tecnologia|autómata|delapouite|
elevator|Ascensor|tecnologia|elevador|delapouite|
atom|Átomo|tecnologia|ciencia,física|skoll|
headphones|Auriculares|tecnologia|música,cascos|delapouite|
earbuds|Auriculares de botón|tecnologia|música|caro-asercion|
auto-repair|Autorreparación|tecnologia|reparar,llave inglesa|lorc|
laser-warning|Aviso láser|tecnologia||lorc|
network-bars|Barras de cobertura|tecnologia||delapouite|
radar-sweep|Barrido de radar|tecnologia|escáner|lorc|
database|Base de datos|tecnologia|almacenamiento|delapouite|
battery-25|Batería al 25 %|tecnologia|pila,poca carga|priorblue|
battery-50|Batería al 50 %|tecnologia|pila,media carga|priorblue|
battery-75|Batería al 75 %|tecnologia|pila,carga|priorblue|
car-battery|Batería de coche|tecnologia|acumulador|delapouite|
heart-battery|Batería de corazón|tecnologia|vida,energía|delapouite|
battery-100|Batería llena|tecnologia|pila,carga completa|priorblue|
battery-plus|Batería más|tecnologia|pila,cargar|priorblue|
battery-minus|Batería menos|tecnologia|pila,descargar|priorblue|
battery-0|Batería vacía|tecnologia|pila,sin carga|priorblue|
tesla-coil|Bobina de Tesla|tecnologia||lorc|
tesla-coil-caro-asercion|Bobina de Tesla grande|tecnologia||caro-asercion|
mesh-ball|Bola de malla|tecnologia||lorc|
morph-ball|Bola morfo|tecnologia||delapouite|
oil-pump|Bomba de petróleo|tecnologia||delapouite|
windpump|Bomba eólica|tecnologia||delapouite|
power-button|Botón de encendido|tecnologia|apagar|lord-berandas|
factory-arm|Brazo industrial|tecnologia|robot,máquina|delapouite|
mechanical-arm|Brazo mecánico|tecnologia||lorc|
spark-plug|Bujía|tecnologia|motor|delapouite|
mecha-head|Cabeza de mecha|tecnologia|robot|delapouite|
calculator|Calculadora|tecnologia|cálculo,números|delapouite|
cryo-chamber|Cámara criogénica|tecnologia|congelación|delapouite|
photo-camera|Cámara de fotos|tecnologia||delapouite|
cctv-camera|Cámara de vigilancia|tecnologia|seguridad|delapouite|
encrypted-channel|Canal cifrado|tecnologia|seguridad|delapouite|
cyborg-face|Cara de cíborg|tecnologia|robot|delapouite|
robot-helmet|Casco de robot|tecnologia|cabeza|delapouite|
starfighter|Caza espacial|tecnologia|nave|delapouite|
processor|Chip de procesador|tecnologia|chip|lorc|
laser-sparks|Chispas láser|tecnologia||lorc|
materials-science|Ciencia de materiales|tecnologia||lorc|
vhs|Cinta VHS|tecnologia||caro-asercion|
circuitry|Circuitos|tecnologia|electrónica|lorc|
plug|Clavija|tecnologia|clavija,electricidad|delapouite|
rocket|Cohete|tecnologia|misil|lorc|
satellite-communication|Comunicación por satélite|tecnologia|antena|delapouite|
jack-plug|Conector jack|tecnologia|cable,audio|delapouite|
planet-conquest|Conquista planetaria|tecnologia||delapouite|
game-console|Consola de videojuegos|tecnologia|videojuegos,mando|delapouite|
techno-heart|Corazón tecnológico|tecnologia||lorc|
habitat-dome|Cúpula habitable|tecnologia|espacio,base|delapouite|
fuel-tank|Depósito de combustible|tecnologia|gasolina,tanque|delapouite|
energy-tank|Depósito de energía|tecnologia|batería|delapouite|
chemical-tank|Depósito químico|tecnologia|tanque,ácido|lorc|
cloud-download|Descarga de la nube|tecnologia|bajar|delapouite|
plasma-bolt|Descarga de plasma|tecnologia||lorc|
unplugged|Desenchufado|tecnologia||sbed|
metal-detector|Detector de metales|tecnologia||delapouite|
led|Diodo LED|tecnologia|luz|delapouite|
compact-disc|Disco compacto|tecnologia|cd|delapouite|
cracked-disc|Disco roto|tecnologia|cd|lorc|
cpu-shot|Disparo al procesador|tecnologia|chip|lorc|
ion-cannon-blast|Disparo de cañón de iones|tecnologia|láser,ciencia ficción|lorc|
double-diaphragm|Doble diafragma|tecnologia|pantalla|lorc|
delivery-drone|Dron de reparto|tecnologia|dron,paquete|delapouite|
ultrasound|Ecografía|tecnologia||lorc|
lightning-electron|Electrón relámpago|tecnologia||lorc|
electrical-socket|Enchufe|tecnologia|corriente|delapouite|
solar-power|Energía solar|tecnologia|paneles|skoll|
pokecog|Engranaje con bola|tecnologia|rueda dentada|lorc|
big-gear|Engranaje grande|tecnologia|rueda dentada,mecanismo|darkzaitzev|
gears|Engranajes|tecnologia|mecanismo,ruedas dentadas|lorc|
escalator|Escalera mecánica|tecnologia|escalera|delapouite|
matter-states|Estados de la materia|tecnologia||delapouite|
static|Estática|tecnologia|interferencia|lorc|
death-star|Estrella de la muerte|tecnologia|nave,espacio|delapouite|
bucket-wheel-excavator|Excavadora de rueda|tecnologia|máquina,mina|caro-asercion|
cogsplosion|Explosión de engranajes|tecnologia|mecanismo|lorc|
laser-blast|Explosión láser|tecnologia||lorc|
fission|Fisión|tecnologia|átomo,nuclear|lorc|
vr-headset|Gafas de realidad virtual|tecnologia||delapouite|
power-generator|Generador eléctrico|tecnologia|energía|delapouite|
gyroscope|Giroscopio|tecnologia|rotación,equilibrio|caro-asercion|
wireframe-globe|Globo de malla|tecnologia||delapouite|
robot-golem|Gólem robot|tecnologia|autómata|lorc|
gps|GPS|tecnologia|navegación,localización|delapouite|
stapler-pneumatic|Grapadora neumática|tecnologia||caro-asercion|
h2o|H2O|tecnologia|agua,fórmula|delapouite|
histogram|Histograma|tecnologia|gráfico,datos|delapouite|
holosphere|Holoesfera|tecnologia|holograma,esfera|lord-berandas|
mushroom-cloud|Hongo nuclear|tecnologia|explosión|lorc|
digital-trace|Huella digital|tecnologia|rastro,datos|spencerdub|
screen-impact|Impacto en pantalla|tecnologia|cristal roto|lorc|
incubator|Incubadora|tecnologia|huevos,bebé|delapouite|
computing|Informática|tecnologia|ordenador|lord-berandas|
artificial-intelligence|Inteligencia artificial|tecnologia|ia,cerebro|lord-berandas|
jetpack|Jetpack|tecnologia|propulsor,vuelo|lorc|
joystick|Joystick|tecnologia|videojuegos,palanca|delapouite|
laser-precision|Láser de precisión|tecnologia||lorc|
kindle|Lector electrónico|tecnologia|libro|lorc|
microscope-lens|Lente de microscopio|tecnologia||lorc|
usb-key|Llave USB|tecnologia||delapouite|
tv-remote|Mando a distancia|tecnologia||delapouite|
gamepad-cross|Mando con cruceta|tecnologia|consola,control|lorc|
gamepad|Mando de videojuegos|tecnologia|consola,control|delapouite|
sewing-machine|Máquina de coser|tecnologia|costura|caro-asercion|
vending-machine|Máquina expendedora|tecnologia||delapouite|
virtual-marker|Marcador virtual|tecnologia||delapouite|
bookmarklet|Marcador web|tecnologia|favorito,navegador|lorc|
gear-hammer|Martillo con engranaje|tecnologia|herramienta,mecánica|lorc|
android-mask|Máscara de androide|tecnologia|robot,máscara|lorc|
mecha-mask|Máscara de mecha|tecnologia||delapouite|
battle-mech|Mecha de combate|tecnologia|robot,máquina de guerra|delapouite|
missile-mech|Mecha de misiles|tecnologia||lorc|
megabot|Megarrobot|tecnologia||lorc|
hypersonic-melon|Melón hipersónico|tecnologia|proyectil,fruta|lorc|
microchip|Microchip|tecnologia||lorc|
microscope|Microscopio|tecnologia||lord-berandas|
jet-pack|Mochila cohete|tecnologia|propulsor,vuelo|sbed|
lunar-module|Módulo lunar|tecnologia|nave|delapouite|
molecule|Molécula|tecnologia||lorc|
molecule-skoll|Molécula Skoll|tecnologia||skoll|
gooey-molecule|Molécula viscosa|tecnologia|baba,átomo|lorc|
vibrating-smartphone|Móvil vibrando|tecnologia||delapouite|
nano-bot|Nanorrobot|tecnologia||delapouite|
spaceship|Nave espacial|tecnologia|cohete|delapouite|
scout-ship|Nave exploradora|tecnologia|espacial|delapouite|
spawn-node|Nodo de aparición|tecnologia|generador|sbed|
nuclear|Nuclear|tecnologia|radiación|sbed|
atom-core|Núcleo atómico|tecnologia|átomo,energía|delapouite|
cyber-eye|Ojo cibernético|tecnologia|implante|delapouite|
static-waves|Ondas estáticas|tecnologia||lorc|
orbital|Orbital|tecnologia||lorc|
pc|Ordenador|tecnologia||skoll|
ufo|Ovni|tecnologia|platillo volante|delapouite|
gear-stick|Palanca de cambios|tecnologia|coche,marchas|delapouite|
battery-pack|Paquete de baterías|tecnologia|pilas,energía|sbed|
battery-pack-alt|Paquete de baterías (alt.)|tecnologia|pilas,energía|sbed|
gear-stick-pattern|Patrón de marchas|tecnologia|coche,palanca|delapouite|
settings-knobs|Perillas de ajustes|tecnologia|configuración|delapouite|
robot-leg|Pierna de robot|tecnologia|prótesis|delapouite|
batteries|Pilas|tecnologia|baterías,energía|lorc|
pylon|Pilón|tecnologia|torre eléctrica|delapouite|
alligator-clip|Pinza de cocodrilo|tecnologia|cable,electrónica|lorc|
robot-grab|Pinza de robot|tecnologia|garra|delapouite|
ray-gun|Pistola de rayos|tecnologia|láser|lorc|
conway-life-glider|Planeador de Conway|tecnologia|autómata|delapouite|
exploding-planet|Planeta explotando|tecnologia|destrucción,espacio|delapouite|
laptop|Portátil|tecnologia|ordenador|delapouite|
afterburn|Poscombustión|tecnologia|propulsor,fuego|lorc|
cpu|Procesador|tecnologia|chip|delapouite|
rocket-thruster|Propulsor de cohete|tecnologia|motor|delapouite|
logic-gate-and|Puerta lógica AND|tecnologia||delapouite|
logic-gate-nand|Puerta lógica NAND|tecnologia||delapouite|
logic-gate-nor|Puerta lógica NOR|tecnologia||delapouite|
logic-gate-not|Puerta lógica NOT|tecnologia||delapouite|
logic-gate-nxor|Puerta lógica NXOR|tecnologia||delapouite|
logic-gate-or|Puerta lógica OR|tecnologia||delapouite|
logic-gate-xor|Puerta lógica XOR|tecnologia||delapouite|
target-laser|Puntería láser|tecnologia||sbed|
server-rack|Rack de servidores|tecnologia|ordenador|delapouite|
radiations|Radiaciones|tecnologia|radiactividad|delapouite|
radioactive|Radiactivo|tecnologia|nuclear|lorc|
pocket-radio|Radio de bolsillo|tecnologia|transistor|delapouite|
laser-burst|Ráfaga láser|tecnologia||skoll|
power-lightning|Rayo de energía|tecnologia|electricidad|lorc|
reactor|Reactor|tecnologia|nuclear|sbed|
water-recycling|Reciclaje de agua|tecnologia||delapouite|
mesh-network|Red de malla|tecnologia||delapouite|
refinery|Refinería|tecnologia|petróleo|delapouite|
nuclear-waste|Residuos nucleares|tecnologia||delapouite|
electrical-resistance|Resistencia eléctrica|tecnologia|electrónica|delapouite|
vintage-robot|Robot antiguo|tecnologia||lorc|
tracked-robot|Robot con orugas|tecnologia||delapouite|
mono-wheel-robot|Robot monorrueda|tecnologia||delapouite|
wifi-router|Router wifi|tecnologia||delapouite|
mars-curiosity|Róver Curiosity|tecnologia||delapouite|
interstellar-path|Ruta interestelar|tecnologia|espacio,camino|lorc|
satellite|Satélite|tecnologia|espacio|lorc|
beam-satellite|Satélite con rayo|tecnologia|satélite,láser|delapouite|
defense-satellite|Satélite de defensa|tecnologia|espacio|delapouite|
radar-cross-section|Sección de radar|tecnologia|sigilo|delapouite|
movement-sensor|Sensor de movimiento|tecnologia||lorc|
bolt-saw|Sierra eléctrica|tecnologia|sierra,rayo|lorc|
time-synchronization|Sincronización del tiempo|tecnologia||delapouite|
mars-pathfinder|Sonda Pathfinder|tecnologia||delapouite|
spoutnik|Sputnik|tecnologia|satélite|lorc|
cloud-upload|Subida a la nube|tecnologia|subir|delapouite|
gas-pump|Surtidor de gasolina|tecnologia|gasolinera,combustible|delapouite|
rss|Suscripción|tecnologia|rss|lorc|
rss-delapouite|Suscripción RSS|tecnologia|feed|delapouite|
tablet|Tableta|tecnologia||skoll|
keyboard|Teclado|tecnologia|ordenador|delapouite|
phone|Teléfono|tecnologia||delapouite|
rotary-phone|Teléfono de disco|tecnologia|antiguo|caro-asercion|
smartphone-skoll|Teléfono inteligente|tecnologia|móvil|skoll|
smartphone|Teléfono móvil|tecnologia|smartphone|delapouite|
tv|Televisión|tecnologia||delapouite|
tesla|Tesla|tecnologia|electricidad|sbed|
radio-tower|Torre de radio|tecnologia|antena|delapouite|
walking-turret|Torreta andante|tecnologia||delapouite|
laser-turret|Torreta láser|tecnologia||delapouite|
tesla-turret|Torreta Tesla|tecnologia||lorc|
space-shuttle|Transbordador espacial|tecnologia|cohete|delapouite|
acid-tube|Tubo de ácido|tecnologia|probeta,laboratorio|sbed|
transparent-tubes|Tubos transparentes|tecnologia||lorc|
turbine|Turbina|tecnologia||delapouite|
speedometer|Velocímetro|tecnologia|velocidad|delapouite|
computer-fan|Ventilador de ordenador|tecnologia|refrigeración|delapouite|
video-camera|Videocámara|tecnologia||delapouite|
video-conference|Videoconferencia|tecnologia||delapouite|
rocket-flight|Vuelo de cohete|tecnologia|despegue|lorc|
walkie-talkie|Walkie-talkie|tecnologia||delapouite|
`

export const GAME_ICONS: readonly GameIcon[] = DATA.trim()
  .split('\n')
  .map((line) => {
    const [id = '', label = '', group = '', words = '', author = '', featured = ''] = line.split('|')
    return {
      id,
      label,
      group: group as GameIconGroup,
      words: words ? words.split(',') : [],
      author,
      featured: !!featured
    }
  })

registerGameIcons(GAME_ICONS)

const BY_ID = new Map(GAME_ICONS.map((icon) => [icon.id, icon]))

/** El icono de rol que dice un valor guardado («gi:dragon-head»), o null (un emoji, o uno que no está) */
export function gameIcon(value: string | null | undefined): GameIcon | null {
  const id = gameIconId(value)
  return id ? (BY_ID.get(id) ?? null) : null
}

/** Los de la selección de siempre, lo primero que se ve */
export const FEATURED_GAME_ICONS = GAME_ICONS.filter((icon) => icon.featured)

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/[-\s,]+/g, ' ')
    .trim()

/** Lo que se busca de cada grupo por su nombre («arma», «criatura»…), palabra por palabra */
const GROUP_WORDS: Record<GameIconGroup, string> = {
  gente: 'gente personaje personajes persona personas',
  criaturas: 'criatura criaturas monstruo monstruos',
  animales: 'animal animales bestia bestias',
  naturaleza: 'naturaleza',
  lugares: 'lugar lugares sitio',
  edificios: 'edificio edificios',
  armas: 'arma armas',
  armaduras: 'armadura armaduras ropa',
  objetos: 'objeto objetos herramienta herramientas',
  magia: 'magia hechizo hechizos',
  religion: 'religion muerte',
  simbolos: 'simbolo simbolos faccion facciones emblema',
  transporte: 'transporte vehiculo vehiculos',
  dinero: 'dinero tesoro tesoros',
  documentos: 'documento documentos libro libros',
  comida: 'comida bebida',
  cuerpo: 'cuerpo salud',
  combate: 'combate habilidad habilidades',
  ocio: 'ocio juego juegos musica',
  tecnologia: 'tecnologia ciencia moderno'
}

interface Entry {
  icon: GameIcon
  label: string
  /** Su nombre, sus palabras y su id, separados por espacios y con uno delante (para buscar por el principio) */
  text: string
  words: string
  group: readonly string[]
}

const INDEX: readonly Entry[] = GAME_ICONS.map((icon) => {
  const label = plain(icon.label)
  const words = plain(icon.words.join(' '))
  return {
    icon,
    label,
    words: ` ${words}`,
    text: ` ${label} ${words} ${plain(icon.id)}`,
    group: GROUP_WORDS[icon.group].split(' ')
  }
})

/** Cuánto se parece (menos, mejor; null, nada) */
function score(entry: Entry, wanted: string, terms: readonly string[]): number | null {
  if (entry.label === wanted) return 0
  if (entry.label.startsWith(wanted)) return 1
  if (` ${entry.label}`.includes(` ${wanted}`)) return 2
  if (entry.words.includes(` ${wanted}`)) return 3
  if (entry.label.includes(wanted)) return 4
  if (entry.text.includes(wanted)) return 5
  const each = terms.map((term) => (entry.text.includes(` ${term}`) ? 0 : entry.group.includes(term) ? 1 : null))
  if (each.some((found) => found === null)) return null
  return each.every((found) => found === 0) ? 6 : 7
}

/**
 * Los iconos que casan con lo buscado (por su nombre o sus palabras en español, o su id en inglés; sin tildes; también
 * el nombre de su grupo, «arma»), los más parecidos primero; sin nada, todos (los destacados primero). Con group, solo
 * los de ese grupo
 */
export function searchGameIcons(query: string, group?: GameIconGroup): GameIcon[] {
  const wanted = plain(query)
  const pool = group ? INDEX.filter((entry) => entry.icon.group === group) : INDEX
  if (!wanted) return pool.map((entry) => entry.icon)
  const terms = wanted.split(' ')
  const found: { icon: GameIcon; score: number }[] = []
  for (const entry of pool) {
    const at = score(entry, wanted, terms)
    if (at !== null) found.push({ icon: entry.icon, score: at })
  }
  return found
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(b.icon.featured) - Number(a.icon.featured) ||
        a.icon.label.localeCompare(b.icon.label, 'es')
    )
    .map((each) => each.icon)
}
