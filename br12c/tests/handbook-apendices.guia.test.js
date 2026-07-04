import { rodarSecao } from "./_runner.js";
import {
  handbookApendiceA,
  handbookApendiceB,
  handbookApendiceC,
  handbookApendiceF,
} from "./fixtures/handbook-apendices.js";

rodarSecao("Manual do proprietário — Apêndice A (RPN e a pilha)", handbookApendiceA);
rodarSecao("Manual do proprietário — Apêndice B (Modo ALG)", handbookApendiceB);
rodarSecao("Manual do proprietário — Apêndice C (Mais sobre a TIR)", handbookApendiceC);
rodarSecao("Manual do proprietário — Apêndice F (Autoteste)", handbookApendiceF);
