// 規範編輯器用哪一組 API：後台＝regulationApi（登入）；App「查規範」提出修改＝regulationProposeApi(app)
import { createContext, useContext } from 'react';
import { regulationApi } from '../../services/api';
export const RegApiCtx = createContext(regulationApi);
export const useRegApi = () => useContext(RegApiCtx);
