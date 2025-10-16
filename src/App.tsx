import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import ContractDetailDocPage from "./components/ContractDetailDocPage";
import UploadPage from "./components/UploadPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/details/:id" element={<ContractDetailDocPage />} />
      </Routes>
    </Router>
  );
}

export default App;
