import { svgUri } from "./svg.js";

/* =========================================================
   ANATOMY & PHYSIOLOGY demo deck — 36 cards. The first six show
   images on cards: three with a diagram on the front, three with
   one on the back. The other 30 are text cards.
   The diagrams are simplified drawings made for this prototype
   (inline SVG, so the app stays one file). Card images live in
   imgQ (front) and imgA (back) as data URIs, the same fields
   used for images people upload to their own cards.
   ========================================================= */
const svgMark = (x, y, t = "?") => `<circle cx='${x}' cy='${y}' r='16' fill='#0f172a'/><text x='${x}' y='${y + 7}' text-anchor='middle' font-size='19' font-weight='700' fill='#fff'>${t}</text>`;
const svgHeart = extra => `
  <g stroke-width='3' stroke-linejoin='round'>
    <rect x='120' y='44' width='110' height='72' rx='18' fill='#dbeafe' stroke='#2563eb'/>
    <rect x='250' y='44' width='110' height='72' rx='18' fill='#fee2e2' stroke='#dc2626'/>
    <path d='M120 128 L230 128 L230 240 C175 223 130 183 120 128 Z' fill='#dbeafe' stroke='#2563eb'/>
    <path d='M250 128 L360 128 C358 193 315 243 250 263 Z' fill='#fee2e2' stroke='#dc2626'/>
  </g>${extra}
  <text x='240' y='290' text-anchor='middle' font-size='12' fill='#64748b'>Front view: the heart's left side is on your right</text>`;
const ANAT_IMG = {
  heartQ: svgUri(svgHeart(svgMark(298, 178))),
  heartFlow: svgUri(svgHeart(`
    ${svgMark(175, 70, "1")}${svgMark(180, 160, "2")}${svgMark(305, 70, "3")}${svgMark(298, 160, "4")}
    <g font-size='12' fill='#0f172a' text-anchor='middle' font-weight='600'>
      <text x='175' y='105'>Right atrium</text><text x='180' y='195'>Right ventricle</text>
      <text x='305' y='105'>Left atrium</text><text x='298' y='195'>Left ventricle</text></g>
    <g font-size='12.5' fill='#334155'>
      <text x='112' y='84' text-anchor='end'>From the body →</text><text x='112' y='170' text-anchor='end'>← To the lungs</text>
      <text x='368' y='84'>← From the lungs</text><text x='368' y='170'>To the body →</text></g>`)),
  neuron: svgUri(`
    <g stroke='#7c3aed' stroke-width='5' stroke-linecap='round' fill='none'>
      <path d='M95 150 L48 86 M62 105 L34 108 M95 150 L28 152 M95 150 L50 222 M64 199 L36 206 M95 150 L104 66 M101 92 L126 70 M95 150 L110 238'/>
      <path d='M127 150 H400 M400 150 L440 110 M400 150 H452 M400 150 L440 190' stroke-width='6'/></g>
    <g fill='#7c3aed'><circle cx='443' cy='107' r='7'/><circle cx='457' cy='150' r='7'/><circle cx='443' cy='193' r='7'/></g>
    <circle cx='95' cy='150' r='32' fill='#ddd6fe' stroke='#7c3aed' stroke-width='3'/><circle cx='95' cy='150' r='11' fill='#7c3aed'/>
    <g fill='#fde68a' stroke='#d97706' stroke-width='2.5'><rect x='150' y='138' width='46' height='24' rx='12'/><rect x='206' y='138' width='46' height='24' rx='12'/><rect x='262' y='138' width='46' height='24' rx='12'/><rect x='318' y='138' width='46' height='24' rx='12'/></g>
    <path d='M285 136 V96' stroke='#0f172a' stroke-width='2.5'/>${svgMark(285, 80)}
    <text x='240' y='290' text-anchor='middle' font-size='12' fill='#64748b'>A nerve cell (neuron)</text>`),
  bone: svgUri(`
    <g fill='#f3e8d0' stroke='#a16207' stroke-width='5'><circle cx='112' cy='130' r='30'/><circle cx='112' cy='174' r='30'/><circle cx='368' cy='130' r='30'/><circle cx='368' cy='174' r='30'/><rect x='118' y='130' width='244' height='44'/></g>
    <g fill='#f3e8d0'><circle cx='112' cy='130' r='28'/><circle cx='112' cy='174' r='28'/><circle cx='368' cy='130' r='28'/><circle cx='368' cy='174' r='28'/><rect x='110' y='132.5' width='260' height='39'/></g>
    <path d='M146 116 V102 H334 V116' fill='none' stroke='#0f172a' stroke-width='2.5'/>${svgMark(240, 80)}
    <text x='240' y='290' text-anchor='middle' font-size='12' fill='#64748b'>A long bone, such as the femur (simplified)</text>`),
  quads: svgUri(`
    <rect x='140' y='40' width='200' height='230' rx='42' fill='#f8fafc' stroke='#64748b' stroke-width='3'/>
    <path d='M240 40 V270 M140 155 H340' stroke='#64748b' stroke-width='2' stroke-dasharray='6 5'/><circle cx='240' cy='155' r='5' fill='#64748b'/>
    <g text-anchor='middle' fill='#0f172a'><g font-size='17' font-weight='700'><text x='190' y='88'>RUQ</text><text x='290' y='88'>LUQ</text><text x='190' y='204'>RLQ</text><text x='290' y='204'>LLQ</text></g>
      <g font-size='12.5' fill='#334155'><text x='190' y='108'>Liver,</text><text x='190' y='124'>gallbladder</text><text x='290' y='108'>Stomach,</text><text x='290' y='124'>spleen</text><text x='190' y='224'>Appendix</text><text x='290' y='224'>Sigmoid colon</text></g>
      <g font-size='12' fill='#64748b'><text x='190' y='27'>Patient's right</text><text x='290' y='27'>Patient's left</text></g></g>`),
  skin: svgUri(`
    <rect x='50' y='40' width='250' height='35' fill='#f5d0a9'/><rect x='50' y='75' width='250' height='110' fill='#fbc8c8'/><rect x='50' y='185' width='250' height='70' fill='#fde68a'/>
    <path d='M50 150 C95 128 130 172 175 148 S255 128 300 150' fill='none' stroke='#dc2626' stroke-width='3'/>
    <g fill='#fef9c3' stroke='#eab308' stroke-width='1.5'><circle cx='85' cy='220' r='20'/><circle cx='135' cy='222' r='22'/><circle cx='187' cy='219' r='20'/><circle cx='236' cy='222' r='21'/><circle cx='280' cy='220' r='16'/></g>
    <rect x='50' y='40' width='250' height='215' fill='none' stroke='#64748b' stroke-width='3'/><path d='M50 75 H300 M50 185 H300' stroke='#64748b' stroke-width='2'/>
    <g fill='#0f172a'><g font-size='15' font-weight='700'><text x='315' y='63'>Epidermis</text><text x='315' y='128'>Dermis</text><text x='315' y='218'>Hypodermis</text></g>
      <g font-size='11.5' fill='#475569'><text x='315' y='145'>vessels, nerves, glands</text><text x='315' y='235'>subcutaneous fat</text></g></g>
    <text x='175' y='28' text-anchor='middle' font-size='12' fill='#64748b'>Skin surface</text>`)
};
const ANAT_CARDS = [
/* ---------- image on the front ---------- */
{id:"an1",imgQ:ANAT_IMG.heartQ,q:`This diagram shows the heart from the front. Which chamber is marked with the question mark?`,
 a:`The left ventricle.`,
 why:`In a front view the heart's left side is on your right. The left ventricle has the thickest wall because it pumps blood to the whole body through the aorta. When it fails, blood backs up into the lungs.`},
{id:"an2",imgQ:ANAT_IMG.neuron,q:`Which part of the neuron is marked?`,
 a:`The myelin sheath.`,
 why:`Myelin insulates the axon so the signal jumps from gap to gap (the nodes of Ranvier) and travels much faster. Multiple sclerosis damages myelin in the brain and spinal cord, which slows or blocks signals.`},
{id:"an3",imgQ:ANAT_IMG.bone,q:`Which part of a long bone does the bracket mark?`,
 a:`The diaphysis (the shaft).`,
 why:`The diaphysis is a tube of compact bone around the medullary cavity, which holds marrow. The rounded ends are the epiphyses; in children the growth plate sits between the two.`},
/* ---------- image on the back ---------- */
{id:"an4",imgA:ANAT_IMG.quads,q:`Name the four abdominal quadrants and one key organ in each.`,
 a:`RUQ: liver and gallbladder. LUQ: stomach and spleen. RLQ: appendix. LLQ: sigmoid colon.`,
 why:`Quadrants are named from the patient's side, so the patient's right is on your left. Pain in the RLQ can point to appendicitis. When assessing the abdomen, listen before you palpate so you don't change the bowel sounds.`},
{id:"an5",imgA:ANAT_IMG.skin,q:`What are the three layers of the skin, from the surface down?`,
 a:`Epidermis, dermis, hypodermis (subcutaneous tissue).`,
 why:`The epidermis has no blood vessels. The dermis holds vessels, nerves, hair follicles and glands. The hypodermis is mostly fat, and it is where subcutaneous injections go.`},
{id:"an6",imgA:ANAT_IMG.heartFlow,q:`Trace the path of blood through the four chambers of the heart, starting as it returns from the body.`,
 a:`Right atrium → right ventricle → lungs → left atrium → left ventricle → body.`,
 why:`The right side sends oxygen-poor blood to the lungs through the pulmonary artery; the left side sends oxygen-rich blood to the body through the aorta.`}
,
/* ---------- text cards: cells and tissues, then one body system after another ---------- */
{id:"ap1",q:"What is the basic structural and functional unit of the human body?",
 a:"The cell",
 why:"Cells carry out essential functions such as metabolism and responding to signals."},
{id:"ap2",q:"Which plane divides the body into equal right and left halves?",
 a:"The midsagittal plane",
 why:"It passes through the body's midline."},
{id:"ap3",q:"What does proximal mean in anatomy?",
 a:"Closer to the point of attachment",
 why:"The elbow is proximal to the wrist because it is closer to where the arm attaches to the trunk."},
{id:"ap4",q:"What is homeostasis?",
 a:"Maintenance of a relatively stable internal environment",
 why:"The body regulates variables such as temperature, blood glucose, and pH as conditions change."},
{id:"ap5",q:"What are the four primary tissue types?",
 a:"Epithelial, connective, muscle, and nervous tissue",
 why:"They cover surfaces, support structures, produce movement, and transmit signals, respectively."},
{id:"ap6",q:"Which organelle produces most ATP during aerobic respiration?",
 a:"The mitochondrion",
 why:"Its inner membrane contains the machinery for oxidative phosphorylation."},
{id:"ap7",q:"Which cells build new bone?",
 a:"Osteoblasts",
 why:"They secrete the organic bone matrix, which later mineralizes."},
{id:"ap8",q:"Which cells break down bone?",
 a:"Osteoclasts",
 why:"They resorb bone during remodeling, helping reshape bone and regulate calcium levels."},
{id:"ap9",q:"What structure connects skeletal muscle to bone?",
 a:"A tendon",
 why:"Tendons transmit the force of muscle contraction to move bones."},
{id:"ap10",q:"What is the basic contractile unit of skeletal muscle?",
 a:"The sarcomere",
 why:"It stretches from one Z disc to the next and shortens as actin and myosin filaments slide past each other."},
{id:"ap11",q:"What neurotransmitter triggers skeletal muscle contraction at the neuromuscular junction?",
 a:"Acetylcholine",
 why:"It binds receptors on the muscle fiber, triggering depolarization."},
{id:"ap12",q:"What structures make up the central nervous system?",
 a:"The brain and spinal cord",
 why:"They process sensory information and coordinate responses."},
{id:"ap13",q:"What is the main function of myelin?",
 a:"To speed up nerve impulse conduction",
 why:"Myelin insulates axons so action potentials can be regenerated at gaps called nodes of Ranvier."},
{id:"ap14",q:"What structure normally initiates each heartbeat?",
 a:"The sinoatrial node",
 why:"Located in the right atrium, it generates the electrical impulses that set the heart's rhythm."},
{id:"ap15",q:"Which heart chamber pumps blood into the systemic circulation?",
 a:"The left ventricle",
 why:"It ejects blood into the aorta for delivery to the body's tissues."},
{id:"ap16",q:"Which valve lies between the left atrium and left ventricle?",
 a:"The mitral valve",
 why:"It closes during ventricular contraction to prevent blood from flowing back into the left atrium."},
{id:"ap17",q:"What determines whether a blood vessel is an artery or a vein?",
 a:"The direction of blood flow relative to the heart",
 why:"Arteries carry blood away from the heart, and veins carry blood toward it."},
{id:"ap18",q:"What protein carries most oxygen in the blood?",
 a:"Hemoglobin",
 why:"Its iron-containing heme groups bind oxygen reversibly inside red blood cells."},
{id:"ap19",q:"Where does gas exchange between air and blood occur in the lungs?",
 a:"The alveoli",
 why:"Oxygen and carbon dioxide diffuse across the thin barrier between the alveoli and surrounding capillaries."},
{id:"ap20",q:"What happens to the diaphragm during quiet inhalation?",
 a:"It contracts and moves downward",
 why:"This increases thoracic volume and lowers pressure in the lungs, drawing air inward."},
{id:"ap21",q:"Where does most nutrient absorption occur?",
 a:"The small intestine",
 why:"Villi and microvilli increase the surface area available for absorption."},
{id:"ap22",q:"Which organ produces bile?",
 a:"The liver",
 why:"The gallbladder stores and concentrates bile, which helps emulsify fats in the small intestine."},
{id:"ap23",q:"What is the main role of pepsin?",
 a:"To digest proteins in the stomach",
 why:"Pepsin works in acidic conditions and breaks proteins into smaller peptides."},
{id:"ap24",q:"What is the functional unit of the kidney?",
 a:"The nephron",
 why:"It filters blood plasma and modifies the filtrate through reabsorption and secretion."},
{id:"ap25",q:"Where does blood filtration begin in the nephron?",
 a:"At the glomerulus",
 why:"Pressure drives water and small solutes from glomerular capillaries into Bowman's capsule."},
{id:"ap26",q:"How does antidiuretic hormone affect the kidneys?",
 a:"It increases water reabsorption in the collecting ducts",
 why:"This reduces water loss in urine and makes the urine more concentrated."},
{id:"ap27",q:"Which pancreatic cells secrete insulin?",
 a:"Beta cells",
 why:"These cells are located in the pancreatic islets and release insulin when blood glucose rises."},
{id:"ap28",q:"What is the main effect of glucagon on blood glucose?",
 a:"It raises blood glucose",
 why:"It signals the liver to break down glycogen and make new glucose."},
{id:"ap29",q:"Which immune cells secrete antibodies?",
 a:"Plasma cells",
 why:"They develop from activated B cells and release antibodies that bind specific antigens."},
{id:"ap30",q:"Where does fertilization most commonly occur?",
 a:"The ampulla of the uterine tube",
 why:"The ampulla is the widest part of the tube and the usual site where sperm and egg meet."}
];
export const ANAT = {id:"anat", name:"Anatomy & Physiology", builtin:true, color:"#0d9488", cards:ANAT_CARDS};
